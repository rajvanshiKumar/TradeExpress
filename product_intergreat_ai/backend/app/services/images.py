"""Image validation/processing, local-disk storage and signed URLs."""
import hashlib
import hmac
import io
import time
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import ValidationFailed

ALLOWED = {"PNG": ("image/png", {"png"}), "JPEG": ("image/jpeg", {"jpg", "jpeg"}),
           "WEBP": ("image/webp", {"webp"})}
THUMB_SIZE = (256, 256)
OPTIMIZED_MAX_SIDE = 1024


@dataclass
class ImageRules:
    max_bytes: int = 10 * 1024 * 1024
    min_width: int = 200
    min_height: int = 200
    max_pixels: int = 50_000_000


@dataclass
class ProcessedImage:
    width: int
    height: int
    mime_type: str
    sha256: str
    size_bytes: int
    thumbnail: bytes
    optimized: bytes


def _jpeg(img: Image.Image, quality: int) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True)  # EXIF is not copied
    return buf.getvalue()


def validate_and_process(data: bytes, filename: str, rules: ImageRules) -> ProcessedImage:
    if len(data) > rules.max_bytes:
        raise ValidationFailed(f"Image exceeds the {rules.max_bytes} byte limit")
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        probe = Image.open(io.BytesIO(data))
        fmt = probe.format or ""
        if probe.width * probe.height > rules.max_pixels:
            raise ValidationFailed("Image dimensions are too large")
        if fmt not in ALLOWED:
            raise ValidationFailed("Unsupported image format (use PNG, JPEG or WebP)")
        mime, exts = ALLOWED[fmt]
        if ext not in exts:
            raise ValidationFailed("File extension does not match the actual image content")
        probe.verify()
        img: Image.Image = Image.open(io.BytesIO(data))
        img.load()
    except ValidationFailed:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError
            ) as exc:
        raise ValidationFailed("File is not a valid, readable image") from exc
    img = ImageOps.exif_transpose(img)
    if img.width < rules.min_width or img.height < rules.min_height:
        raise ValidationFailed(
            f"Image resolution too low (minimum {rules.min_width}x{rules.min_height})")
    thumb = img.copy()
    thumb.thumbnail(THUMB_SIZE)
    opt = img.copy()
    opt.thumbnail((OPTIMIZED_MAX_SIDE, OPTIMIZED_MAX_SIDE))
    return ProcessedImage(img.width, img.height, mime, hashlib.sha256(data).hexdigest(),
                          len(data), _jpeg(thumb, 80), _jpeg(opt, 88))


class LocalImageStore:
    def __init__(self, root: Path | str) -> None:
        self.root = Path(root).resolve()

    def _resolve(self, key: str) -> Path:
        p = PurePosixPath(key)
        if not key or p.is_absolute() or "\\" in key or ".." in p.parts or ":" in key:
            raise ValidationFailed("Invalid storage key")
        full = (self.root / key).resolve()
        if self.root not in full.parents:
            raise ValidationFailed("Invalid storage key")
        return full

    def put(self, key: str, data: bytes) -> None:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key: str) -> bytes:
        return self._resolve(key).read_bytes()

    def delete(self, key: str) -> None:
        self._resolve(key).unlink(missing_ok=True)


def _mac(image_id: str, exp: int, secret: str) -> str:
    return hmac.new(secret.encode(), f"{image_id}:{exp}".encode(), hashlib.sha256).hexdigest()


def sign_url_params(image_id: str, secret: str, ttl_seconds: int, now: int | None = None
                    ) -> tuple[int, str]:
    exp = int(now if now is not None else time.time()) + ttl_seconds
    return exp, _mac(image_id, exp, secret)


def verify_signature(image_id: str, exp: int, sig: str, secret: str, now: int | None = None
                     ) -> bool:
    current = int(now if now is not None else time.time())
    return current <= exp and hmac.compare_digest(_mac(image_id, exp, secret), sig)
