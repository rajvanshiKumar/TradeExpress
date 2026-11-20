import base64

import pytest
from fastapi.testclient import TestClient

from app.ai.base import ProviderResult, Usage
from app.core.config import Settings
from app.main import create_app

API_KEY = "test-key-0123456789abcdef"
CATEGORIES = [
    {"slug": "fasteners", "name": "Nuts, Bolts and Fasteners"},
    {"slug": "textiles", "name": "Textiles and Fabrics"},
    {"slug": "packaging", "name": "Packaging Materials"},
]
TODAY = "2026-11-13"


def fake_image(mime: str = "image/png") -> dict:
    """Smallest thing that passes the magic-byte check (the fake/scripted providers ignore pixels)."""
    head = {"image/png": b"\x89PNG\r\n\x1a\n", "image/jpeg": b"\xff\xd8\xff\xe0",
            "image/webp": b"RIFF\x00\x00\x00\x00WEBP"}[mime]
    return {"mime_type": mime, "data_base64": base64.b64encode(head + b"0" * 200).decode()}


class Scripted:
    """Provider that returns a chosen (possibly hostile) extraction and records what it was sent."""
    name = "scripted"

    def __init__(self, ext):
        self.ext = ext
        self.last_text = ""
        self.last_images = []
        self.last_context = ""

    async def generate_structured(self, **kw):
        self.last_text, self.last_images = kw["untrusted_text"], kw.get("images") or []
        self.last_context = kw["context"]
        return ProviderResult(self.ext, Usage("scripted", "m", "v", 1, 1, None, 1, kw["stage"]))


@pytest.fixture
def settings() -> Settings:
    return Settings(api_key=API_KEY, ai_provider="fake", environment="test")  # type: ignore[arg-type]


@pytest.fixture
def app(settings):
    return create_app(settings)


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def headers():
    return {"X-API-Key": API_KEY}
