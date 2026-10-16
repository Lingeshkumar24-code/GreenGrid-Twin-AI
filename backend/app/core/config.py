from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


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


@lru_cache
def get_settings() -> Settings:
    return Settings()
