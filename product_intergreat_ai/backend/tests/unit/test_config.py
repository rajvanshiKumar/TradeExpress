import pytest
from pydantic import ValidationError

from app.core.config import Settings


def make(**kw):
    base = {"database_url": "postgresql+asyncpg://u:p@h/db", "jwt_secret": "x" * 40}
    return Settings(_env_file=None, **{**base, **kw})


def test_defaults_are_development(monkeypatch):
    monkeypatch.delenv("TX_ENVIRONMENT", raising=False)
    s = make()
    assert s.environment == "development"
    assert s.access_token_ttl_minutes > 0


def test_short_jwt_secret_rejected():
    with pytest.raises(ValidationError):
        make(jwt_secret="short")


def test_production_rejects_placeholder_secret():
    with pytest.raises(ValidationError):
        make(environment="production", jwt_secret="change-me-" + "x" * 40)


def test_production_requires_explicit_cors_origins():
    with pytest.raises(ValidationError):
        make(environment="production", cors_origins=["*"])


def test_async_driver_enforced():
    with pytest.raises(ValidationError):
        make(database_url="postgresql://u:p@h/db")
