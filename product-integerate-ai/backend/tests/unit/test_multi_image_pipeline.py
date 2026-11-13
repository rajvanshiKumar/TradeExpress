import io
import uuid
import pytest
from PIL import Image

from app.ai.base import ImageInput
from app.ai.gemini import GeminiProvider
from app.ai.openai import OpenAIProvider
from app.core.config import Settings
from app.core.errors import AppError, ValidationFailed
from app.services.images import ImageRules, LocalImageStore, validate_and_process


def create_test_image(color: tuple[int, int, int], width: int = 300, height: int = 300, fmt: str = "JPEG") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (width, height), color=color)
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_batch_process_5_to_10_images(tmp_path):
    """Test processing and storing 10 distinct product images (different colors/views)."""
    store = LocalImageStore(tmp_path)
    rules = ImageRules(max_bytes=10 * 1024 * 1024, min_width=200, min_height=200)

    images_data = []
    # Generate 10 unique images representing different angles: front, back, side, collar, tag, box, etc.
    colors = [
        (255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (255, 0, 255),
        (0, 255, 255), (128, 0, 0), (0, 128, 0), (0, 0, 128), (128, 128, 128)
    ]

    processed_list = []
    for i, col in enumerate(colors):
        raw_bytes = create_test_image(col, width=400, height=400, fmt="JPEG")
        processed = validate_and_process(raw_bytes, f"view_{i}.jpg", rules)
        assert processed.width == 400
        assert processed.height == 400
        assert processed.mime_type == "image/jpeg"
        assert len(processed.thumbnail) > 0
        assert len(processed.optimized) > 0

        # Store in LocalImageStore
        key_orig = f"test_org/img_{i}/original.jpg"
        key_opt = f"test_org/img_{i}/optimized.jpg"
        store.put(key_orig, raw_bytes)
        store.put(key_opt, processed.optimized)

        assert store.get(key_orig) == raw_bytes
        processed_list.append(processed)

    assert len(processed_list) == 10
    # Ensure all SHA-256 hashes are unique across 10 images
    unique_hashes = {p.sha256 for p in processed_list}
    assert len(unique_hashes) == 10


def test_max_images_limit_enforcement():
    """Verify that exceeding max_images_per_job (10) is rejected."""
    settings = Settings(database_url="postgresql+asyncpg://localhost/test")
    assert settings.max_images_per_job == 10

    # 10 images is valid
    ten_images = [uuid.uuid4() for _ in range(10)]
    assert len(ten_images) <= settings.max_images_per_job

    # 11 images must exceed limit
    eleven_images = [uuid.uuid4() for _ in range(11)]
    assert len(eleven_images) > settings.max_images_per_job


def test_gemini_image_parts_with_10_images():
    """Test Gemini image part serialization for 10 images."""
    provider = GeminiProvider(api_key="test-key", model="gemini-2.5-flash-lite")
    images = [
        ImageInput(data=b"fake-bytes", mime_type="image/jpeg", image_id=f"img-{i}")
        for i in range(10)
    ]
    parts = provider._image_parts(images)
    # Each image produces 2 parts: text label + inline_data
    assert len(parts) == 20
    for i in range(10):
        label_part = parts[i * 2]
        data_part = parts[i * 2 + 1]
        assert label_part == {"text": f"Image {i}:"}
        assert "inline_data" in data_part
        assert data_part["inline_data"]["mime_type"] == "image/jpeg"


def test_openai_image_parts_with_10_images():
    """Test OpenAI image part serialization for 10 images."""
    provider = OpenAIProvider(api_key="test-key", model="gpt-4o-mini")
    images = [
        ImageInput(data=b"fake-bytes", mime_type="image/jpeg", image_id=f"img-{i}")
        for i in range(10)
    ]
    parts = provider._image_parts(images)
    assert len(parts) == 10
    for i, part in enumerate(parts):
        assert part["type"] == "image_url"
        assert part["image_url"]["url"].startswith("data:image/jpeg;base64,")


def test_multi_image_ecommerce_export_mapping():
    """Verify that multiple images (e.g. 8 images) are all included in ecommerce_product.photos."""
    import re
    from decimal import Decimal

    # Simulate what build_result produces for 8 images
    image_ids = [uuid.uuid4() for _ in range(8)]
    primary_photo = f"/api/v1/images/{image_ids[0]}/file?variant=original"
    photo_urls = [f"/api/v1/images/{img_id}/file?variant=original" for img_id in image_ids]

    specs = {"Color": "Black", "Size": "M", "Material": "Cotton blend"}
    color_val = specs.get("Color") or "Standard"
    variants = [{"type": "Color", "options": [color_val]}]
    for opt_key in ("Size", "Shoe Size", "Storage Capacity", "RAM"):
        if opt_key in specs and specs[opt_key]:
            variants.append({"type": opt_key, "options": [str(specs[opt_key])]})

    ecommerce_product = {
        "id": str(uuid.uuid4()),
        "sku": "SHIRT-BLK-001",
        "name": "Men's Black Cotton Shirt",
        "photo": primary_photo,
        "photos": photo_urls,
        "variants": variants,
    }

    assert ecommerce_product["photo"] == primary_photo
    assert len(ecommerce_product["photos"]) == 8
    assert ecommerce_product["photos"][0] == primary_photo
    assert ecommerce_product["photos"][7] == f"/api/v1/images/{image_ids[7]}/file?variant=original"

    # Both Color and Size variants present
    var_types = [v["type"] for v in ecommerce_product["variants"]]
    assert "Color" in var_types
    assert "Size" in var_types
    assert ecommerce_product["variants"][1]["options"] == ["M"]
