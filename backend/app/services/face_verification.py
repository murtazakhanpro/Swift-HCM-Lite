import base64
import binascii
import io
import importlib.util
import json
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from app.core.config import settings


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
    return all(importlib.util.find_spec(name) is not None for name in ("libreyolo", "onnxruntime", "PIL"))


def decode_image(value: str) -> Image.Image:
    encoded = value.split(",", 1)[1] if value.startswith("data:") and "," in value else value
    try:
        raw = base64.b64decode(encoded, validate=True)
        if len(raw) > 2_000_000:
            raise ValueError("Image is too large")
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        if image.width < 160 or image.height < 160:
            raise ValueError("Image resolution is too small")
        return image
    except (binascii.Error, ValueError, UnidentifiedImageError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid face image: {exc}")


@lru_cache(maxsize=1)
def _load_model():
    try:
        from libreyolo import LibreYOLO
        return LibreYOLO(settings.FACE_MODEL_ID)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Face model could not load: {exc}")


def get_embedding(image_b64: str) -> list[float]:
    image = decode_image(image_b64)
    try:
        result = _load_model()(image)
        embeddings = result.embeddings.data
        if embeddings is None or len(embeddings) != 1:
            raise HTTPException(status_code=422, detail="Exactly one clear face must be visible.")
        vector = embeddings[0].tolist() if hasattr(embeddings[0], "tolist") else list(embeddings[0])
        return [float(value) for value in vector]
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Face analysis failed: {exc}")


def encrypt_embedding(vector: list[float]) -> str:
    return _fernet().encrypt(json.dumps(vector, separators=(",", ":")).encode()).decode()


def decrypt_embedding(value: str) -> list[float]:
    try:
        return json.loads(_fernet().decrypt(value.encode()).decode())
    except (InvalidToken, ValueError, TypeError):
        raise HTTPException(status_code=503, detail="Stored face template cannot be decrypted with the configured key.")


def compare_embeddings(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        raise HTTPException(status_code=503, detail="Stored face template has an invalid format.")
    return sum(a * b for a, b in zip(left, right))
