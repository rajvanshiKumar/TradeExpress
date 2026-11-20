from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_prefix="ASSIST_", extra="ignore")

    environment: Literal["development", "test", "staging", "production"] = "development"
    api_key: SecretStr = Field(min_length=16)
    ai_provider: Literal["fake", "gemini", "openai"] = "fake"
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.5-flash-lite"
    openai_api_key: SecretStr | None = None
    openai_model: str = "gpt-4o-mini"
    provider_timeout_seconds: float = 30.0
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    rate_limit_per_minute: int = 30
    max_request_bytes: int = 12 * 1024 * 1024  # room for 4 document images as base64
    # Driver licence photos contain personal data and are sent to the AI provider. Switch off if
    # your compliance review says no (the endpoint then answers 403).
    enable_driver_documents: bool = True

    @model_validator(mode="after")
    def _check(self) -> "Settings":
        if self.ai_provider == "fake" and self.environment in ("staging", "production"):
            raise ValueError("ASSIST_AI_PROVIDER=fake is not allowed in staging/production")
        if self.environment in ("staging", "production") and "*" in self.cors_origins:
            raise ValueError("cors_origins must be an explicit allowlist")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
