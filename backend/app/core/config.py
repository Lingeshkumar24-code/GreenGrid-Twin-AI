from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _bounded_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


def _bounded_float(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    return max(minimum, min(value, maximum))


class Settings:
    """Server-side configuration read from environment variables only."""

    def __init__(self) -> None:
        self.app_name: str = "GreenGrid Twin AI API"
        self.demo_mode: bool = os.getenv("DEMO_MODE", "true").lower() == "true"
        self.database_url: str | None = os.getenv("DATABASE_URL") or None
        raw_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
        self.frontend_origins: list[str] = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
        self.groq_api_key: str | None = os.getenv("GROQ_API_KEY") or None
        self.groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        self.ai_provider_api_key: str | None = os.getenv("AI_PROVIDER_API_KEY") or None
        self.environment: str = os.getenv("ENVIRONMENT", "development")
        self.vision_model_weights: str = os.getenv("VISION_MODEL_WEIGHTS", "yolo26n.pt").strip() or "yolo26n.pt"
        self.vision_confidence: float = _bounded_float("VISION_CONFIDENCE", 0.35, 0.05, 0.95)
        self.vision_min_quality: float = _bounded_float("VISION_MIN_QUALITY", 0.25, 0.0, 1.0)
        self.vision_sample_every: int = _bounded_int("VISION_SAMPLE_EVERY", 5, 1, 120)
        self.vision_max_upload_mb: int = _bounded_int("VISION_MAX_UPLOAD_MB", 50, 1, 250)
        self.vision_max_video_seconds: int = _bounded_int("VISION_MAX_VIDEO_SECONDS", 120, 1, 1800)
        self.vision_empty_confirm_seconds: int = _bounded_int("VISION_EMPTY_CONFIRM_SECONDS", 60, 1, 3600)
        self.vision_max_pixels: int = _bounded_int("VISION_MAX_PIXELS", 12000000, 307200, 40000000)


@lru_cache
def get_settings() -> Settings:
    return Settings()
