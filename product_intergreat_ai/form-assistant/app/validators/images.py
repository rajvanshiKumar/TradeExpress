"""Decode and sanity-check base64 document images sent by the client."""
import base64
import binascii
from typing import Literal

from pydantic import BaseModel, Field

from app.ai.base import ImageInput
from app.core.errors import AppError

MAX_IMAGES = 4
MAX_IMAGE_BYTES = 5 * 1024 * 1024
_MAGIC = {
    "image/jpeg": b"\xff\xd8\xff",
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/webp": b"RIFF",
}


class ImageIn(BaseModel):
    mime_type: Literal["image/jpeg", "image/png", "image/webp"]
    data_base64: str = Field(min_length=100, max_length=int(MAX_IMAGE_BYTES * 1.4))


class BadImage(AppError):
    status_code = 422
    code = "invalid_image"


def decode_images(items: list[ImageIn]) -> list[ImageInput]:
    if len(items) > MAX_IMAGES:
        raise BadImage(f"At most {MAX_IMAGES} images per request")
    out: list[ImageInput] = []
    for i, item in enumerate(items, start=1):
        try:
            raw = base64.b64decode(item.data_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise BadImage(f"Image {i} is not valid base64") from exc
        if len(raw) > MAX_IMAGE_BYTES:
            raise BadImage(f"Image {i} is larger than {MAX_IMAGE_BYTES // (1024 * 1024)} MB")
        is_webp = item.mime_type == "image/webp"
        if not raw.startswith(_MAGIC[item.mime_type]) or (is_webp and raw[8:12] != b"WEBP"):
            raise BadImage(f"Image {i} content does not match {item.mime_type}")
        out.append(ImageInput(raw, item.mime_type))
    return out
