import os
import sys

import pytest
from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import Settings


def test_production_rejects_known_development_jwt_secret():
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            JWT_SECRET="swift_hcm_super_secret_jwt_key_for_development",
        )


def test_production_accepts_unique_jwt_secret():
    settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        JWT_SECRET="a-unique-production-secret-with-more-than-32-characters",
    )

    assert settings.ENVIRONMENT == "production"
