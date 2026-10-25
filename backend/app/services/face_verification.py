import base64
import binascii
import io
import importlib.util
import json
import math
from functools import lru_cache
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from app.core.config import settings


FACE_MODEL_FILES = ("scrfd_10g_bnkps.onnx", "glintr100.onnx")


def _fernet() -> Fernet:
    if not settings.FACE_ENCRYPTION_KEY:
        raise HTTPException(status_code=503, detail="Face verification is not configured. Set FACE_ENCRYPTION_KEY.")
    try:
        return Fernet(settings.FACE_ENCRYPTION_KEY.encode("ascii"))
    except (ValueError, UnicodeEncodeError):
        raise HTTPException(status_code=503, detail="FACE_ENCRYPTION_KEY must be a valid Fernet key.")


def face_verification_enabled() -> bool:
    try:
        _fernet()
    except HTTPException:
        return False
    return all(importlib.util.find_spec(name) is not None for name in ("onnxruntime", "cv2", "numpy", "huggingface_hub"))


def decode_image(value: str) -> Image.Image:
    encoded = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > 2_000_000:
            raise ValueError("Image is too large (maximum 2 MB)")
        image = Image.open(io.BytesIO(raw))
        if image.width < 160 or image.height < 160:
            raise ValueError("Image resolution is too small; use at least 160 x 160 pixels")
        if image.width * image.height > 12_000_000:
            raise ValueError("Image dimensions are too large")
        return image.convert("RGB")
    except (binascii.Error, ValueError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid face image: {exc}") from exc


@lru_cache(maxsize=1)
def download_face_model() -> Path:
    """Download only AuraFace detection and recognition files into the HF cache."""
    try:
        from huggingface_hub import snapshot_download

        snapshot = snapshot_download(
            repo_id=settings.FACE_MODEL_ID,
            revision=settings.FACE_MODEL_REVISION,
            allow_patterns=list(FACE_MODEL_FILES),
        )
        model_dir = Path(snapshot)
        missing = [name for name in FACE_MODEL_FILES if not (model_dir / name).is_file()]
        if missing:
            raise RuntimeError(f"Model repository is missing required files: {', '.join(missing)}")
        return model_dir
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AuraFace model could not be downloaded. Check Hugging Face access and network availability.") from exc


@lru_cache(maxsize=1)
def _load_models():
    try:
        import onnxruntime as ort

        model_dir = download_face_model()
        providers = ["CPUExecutionProvider"]
        detector = ort.InferenceSession(str(model_dir / "scrfd_10g_bnkps.onnx"), providers=providers)
        recognizer = ort.InferenceSession(str(model_dir / "glintr100.onnx"), providers=providers)
        return detector, recognizer
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="AuraFace could not initialize with the ONNX Runtime CPU provider.") from exc


def _detect_faces(image_bgr, detector, cv2, np):
    """Run AuraFace's SCRFD detector and decode its three FPN output heads."""
    input_size = (640, 640)
    height, width = image_bgr.shape[:2]
    scale = min(input_size[0] / width, input_size[1] / height)
    resized_width = int(width * scale)
    resized_height = int(height * scale)
    resized = cv2.resize(image_bgr, (resized_width, resized_height))
    canvas = np.zeros((input_size[1], input_size[0], 3), dtype=np.uint8)
    canvas[:resized_height, :resized_width] = resized
    blob = cv2.dnn.blobFromImage(
        canvas, 1.0 / 128.0, input_size, (127.5, 127.5, 127.5), swapRB=True
    )
    outputs = detector.run(None, {detector.get_inputs()[0].name: blob})
    if len(outputs) < 9:
        raise RuntimeError("Unexpected SCRFD output layout")

    boxes, scores_all, landmarks_all = [], [], []
    for level, stride in enumerate((8, 16, 32)):
        scores = np.asarray(outputs[level]).reshape(-1)
        box_distances = np.asarray(outputs[level + 3]).reshape(-1, 4) * stride
        keypoint_distances = np.asarray(outputs[level + 6]).reshape(-1, 5, 2) * stride
        grid_height, grid_width = input_size[1] // stride, input_size[0] // stride
        grid_y, grid_x = np.mgrid[:grid_height, :grid_width]
        centers = np.stack((grid_x, grid_y), axis=-1).astype(np.float32).reshape(-1, 2)
        centers = np.repeat(centers, 2, axis=0) * stride

        if len(scores) != len(centers):
            raise RuntimeError("SCRFD output dimensions do not match its anchors")
        selected = np.flatnonzero(scores >= 0.5)
        if selected.size == 0:
            continue
        center = centers[selected]
        distances = box_distances[selected]
        decoded_boxes = np.column_stack((
            center[:, 0] - distances[:, 0], center[:, 1] - distances[:, 1],
            center[:, 0] + distances[:, 2], center[:, 1] + distances[:, 3],
        )) / scale
        decoded_landmarks = (center[:, None, :] + keypoint_distances[selected]) / scale
        boxes.extend(decoded_boxes.tolist())
        scores_all.extend(scores[selected].tolist())
        landmarks_all.extend(decoded_landmarks.tolist())

    if not boxes:
        return np.empty((0, 5), dtype=np.float32), np.empty((0, 5, 2), dtype=np.float32)

    rectangles = [[box[0], box[1], box[2] - box[0], box[3] - box[1]] for box in boxes]
    keep = cv2.dnn.NMSBoxes(rectangles, scores_all, 0.5, 0.4)
    indices = np.asarray(keep).reshape(-1).astype(int) if len(keep) else np.array([], dtype=int)
    detections = np.asarray([[*boxes[i], scores_all[i]] for i in indices], dtype=np.float32)
    landmarks = np.asarray([landmarks_all[i] for i in indices], dtype=np.float32)
    return detections, landmarks


def _recognize_face(image_bgr, landmarks, recognizer, cv2, np):
    """ArcFace-align five SCRFD landmarks and run AuraFace's 512D ONNX head."""
    reference = np.asarray([
        [38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366],
        [41.5493, 92.3655], [70.7299, 92.2041],
    ], dtype=np.float32)
    transform, _ = cv2.estimateAffinePartial2D(landmarks.astype(np.float32), reference, method=cv2.LMEDS)
    if transform is None:
        raise HTTPException(status_code=422, detail="Could not align the detected face. Look directly at the camera.")
    aligned = cv2.warpAffine(image_bgr, transform, (112, 112), borderValue=0.0)
    blob = cv2.dnn.blobFromImage(
        aligned, 1.0 / 127.5, (112, 112), (127.5, 127.5, 127.5), swapRB=True
    )
    output = recognizer.run(None, {recognizer.get_inputs()[0].name: blob})[0]
    vector = np.asarray(output, dtype=np.float32).reshape(-1)
    if vector.size != 512 or not np.isfinite(vector).all():
        raise HTTPException(status_code=503, detail="AuraFace returned an invalid face embedding.")
    norm = float(np.linalg.norm(vector))
    if norm <= 0:
        raise HTTPException(status_code=422, detail="Could not extract a usable face embedding.")
    return (vector / norm).astype(float).tolist()


def get_embedding(image_b64: str) -> list[float]:
    image = decode_image(image_b64)
    try:
        import cv2
        import numpy as np

        image_bgr = cv2.cvtColor(np.asarray(image), cv2.COLOR_RGB2BGR)
        detector, recognizer = _load_models()
        detections, landmarks = _detect_faces(image_bgr, detector, cv2, np)
        if detections is None or len(detections) == 0:
            raise HTTPException(status_code=422, detail="No face detected. Center your face in the frame and try again.")
        if len(detections) != 1 or landmarks is None or len(landmarks) != 1:
            raise HTTPException(status_code=422, detail="Exactly one clear face must be visible.")
        if float(detections[0][4]) < 0.5:
            raise HTTPException(status_code=422, detail="Face is not clear enough. Improve the lighting and try again.")

        return _recognize_face(image_bgr, landmarks[0], recognizer, cv2, np)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Face analysis failed. Confirm that the AuraFace model is cached and try again.") from exc


def encrypt_embedding(vector: list[float]) -> str:
    record = {"model_id": settings.FACE_MODEL_ID, "embedding": vector}
    return _fernet().encrypt(json.dumps(record, separators=(",", ":")).encode()).decode()


def decrypt_embedding(value: str) -> list[float]:
    try:
        record = json.loads(_fernet().decrypt(value.encode()).decode())
    except (InvalidToken, ValueError, TypeError) as exc:
        raise HTTPException(status_code=503, detail="Stored face template cannot be decrypted with the configured key.") from exc
    if not isinstance(record, dict) or record.get("model_id") != settings.FACE_MODEL_ID:
        raise HTTPException(status_code=409, detail="Face model changed. Delete and enroll your face again.")
    vector = record.get("embedding")
    if not isinstance(vector, list) or len(vector) != 512:
        raise HTTPException(status_code=409, detail="Stored face template is outdated. Enroll your face again.")
    return vector


def compare_embeddings(left: list[float], right: list[float]) -> float:
    if len(left) != 512 or len(right) != 512:
        raise HTTPException(status_code=409, detail="Face templates are incompatible. Enroll your face again.")
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        raise HTTPException(status_code=409, detail="Stored face template is invalid. Enroll your face again.")
    return sum(a * b for a, b in zip(left, right)) / (left_norm * right_norm)
