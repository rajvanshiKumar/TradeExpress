from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), env_prefix="TX_", extra="ignore")

    environment: Literal["development", "test", "staging", "production"] = "development"
    database_url: str
    # Role the API connection switches to so PostgreSQL RLS applies (non-superuser).
    db_app_role: str | None = "tx_app"
    jwt_secret: str = Field(min_length=32)
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 14
    cors_origins: list[str] = ["http://localhost:3000"]
    max_request_bytes: int = 15 * 1024 * 1024
    ai_provider: Literal["gemini", "openai", "fake"] = "gemini"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_timeout_seconds: float = 60.0
    gemini_price_in_per_m: float | None = None
    gemini_price_out_per_m: float | None = None

    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: float = 60.0
    openai_price_in_per_m: float | None = 0.15
    openai_price_out_per_m: float | None = 0.60

    storage_dir: str = "./storage"
    signed_url_ttl_seconds: int = 900
    max_image_bytes: int = 10 * 1024 * 1024
    min_image_px: int = 200
    max_images_per_job: int = 10
    max_bulk_items: int = 50
    max_zip_uncompressed_bytes: int = 200 * 1024 * 1024
    job_concurrency: int = 3

    @model_validator(mode="after")
    def _check(self) -> "Settings":
        if not self.database_url.startswith("postgresql+asyncpg://"):
            raise ValueError("database_url must use the postgresql+asyncpg:// driver")
        if self.environment in ("staging", "production"):
            if self.jwt_secret.startswith("change-me"):
                raise ValueError("jwt_secret must not be a placeholder outside development")
            if "*" in self.cors_origins:
                raise ValueError("cors_origins must be an explicit allowlist")
        if self.ai_provider == "fake" and self.environment != "test":
            raise ValueError("ai_provider=fake is only allowed when environment=test")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
