"""Pre-cache the AuraFace ONNX files before starting the API (optional)."""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.face_verification import download_face_model  # noqa: E402


if __name__ == "__main__":
    print(f"AuraFace model files cached at: {download_face_model()}")
