from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, model_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "Swift-HCM Lite"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    PORT: int = 8000
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"
    
    # Security
    JWT_SECRET: str = Field(default="swift_hcm_super_secret_jwt_key_2026_saylani_hackathon_lyntica")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Database (Dual mode: sqlite async fallback or postgres asyncpg)
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./swift_hcm.db")
    
    # AI Engine
    GEMINI_API_KEY: str = Field(default="")
    AI_MODEL: str = Field(default="gemini-3.5-flash-lite")

    # Face verification is disabled until a Fernet key is explicitly configured.
    FACE_ENCRYPTION_KEY: str = Field(default="")
    FACE_MODEL_ID: str = Field(default="fal/AuraFace-v1")
    FACE_MODEL_REVISION: str = Field(default="main")
    FACE_MATCH_THRESHOLD: float = Field(default=0.65, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.ENVIRONMENT.lower() == "production":
            insecure_secret = (
                len(self.JWT_SECRET) < 32
                or self.JWT_SECRET.startswith("swift_hcm_super_secret")
                or self.JWT_SECRET.lower().startswith("your_")
            )
            if insecure_secret:
                raise ValueError("Production requires a unique JWT_SECRET of at least 32 characters")
        return self
    
    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
