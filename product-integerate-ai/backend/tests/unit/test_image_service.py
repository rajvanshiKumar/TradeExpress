import hashlib
import io

import pytest
from PIL import Image

from app.core.errors import ValidationFailed
from app.services.images import (
    ImageRules,
    LocalImageStore,
    sign_url_params,
    validate_and_process,
    verify_signature,
)

RULES = ImageRules(max_bytes=200_000, min_width=64, min_height=64, max_pixels=4_000_000)


def png(w=200, h=150, color=(200, 30, 30), fmt="PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, fmt)
    return buf.getvalue()


def test_valid_image_metadata_and_hash():
    data = png()
    info = validate_and_process(data, "photo.png", RULES)
    assert (info.width, info.height, info.mime_type) == (200, 150, "image/png")
    assert info.sha256 == hashlib.sha256(data).hexdigest()
    assert info.size_bytes == len(data) and info.thumbnail and info.optimized


def test_extension_must_match_real_content():
    with pytest.raises(ValidationFailed):
        validate_and_process(png(), "photo.jpg", RULES)


def test_jpeg_accepted_with_matching_extension():
    assert validate_and_process(png(fmt="JPEG"), "a.jpeg", RULES).mime_type == "image/jpeg"


def test_non_image_disguised_as_image_rejected():
    with pytest.raises(ValidationFailed):
        validate_and_process(b"<?php echo 1; ?>" * 50, "evil.png", RULES)


def test_corrupted_image_rejected():
    with pytest.raises(ValidationFailed):
        validate_and_process(png()[:-40] + b"\x00" * 40 if False else png()[:80], "x.png", RULES)


def test_too_large_rejected():
    with pytest.raises(ValidationFailed):
        validate_and_process(png(), "a.png", ImageRules(max_bytes=100, min_width=1, min_height=1,
                                                         max_pixels=10**9))


def test_low_resolution_rejected():
    with pytest.raises(ValidationFailed):
        validate_and_process(png(32, 32), "a.png", RULES)


def test_decompression_bomb_rejected():
    with pytest.raises(ValidationFailed):
        validate_and_process(png(3000, 3000), "a.png", ImageRules(max_bytes=10**7, min_width=1,
                                                                   min_height=1, max_pixels=1_000_000))


def test_unsupported_format_rejected():
    buf = io.BytesIO()
    Image.new("RGB", (100, 100)).save(buf, "BMP")
    with pytest.raises(ValidationFailed):
        validate_and_process(buf.getvalue(), "a.bmp", RULES)


def test_exif_orientation_applied_and_stripped():
    img = Image.new("RGB", (200, 100), "red")
    exif = Image.Exif()
    exif[0x0112] = 6  # rotate 90 CW
    buf = io.BytesIO()
    img.save(buf, "JPEG", exif=exif)
    info = validate_and_process(buf.getvalue(), "a.jpg", RULES)
    assert (info.width, info.height) == (100, 200)


def test_store_roundtrip_and_path_traversal_blocked(tmp_path):
    store = LocalImageStore(tmp_path)
    store.put("org1/abc.png", b"data")
    assert store.get("org1/abc.png") == b"data"
    with pytest.raises(ValidationFailed):
        store.put("../../escape.png", b"x")
    with pytest.raises(ValidationFailed):
        store.get("/etc/passwd")
    store.delete("org1/abc.png")
    with pytest.raises(FileNotFoundError):
        store.get("org1/abc.png")


def test_signed_url_roundtrip_expiry_and_tamper():
    secret = "s" * 40
    exp, sig = sign_url_params("img-1", secret, ttl_seconds=60, now=1000)
    assert verify_signature("img-1", exp, sig, secret, now=1010)
    assert not verify_signature("img-1", exp, sig, secret, now=exp + 1)
    assert not verify_signature("img-2", exp, sig, secret, now=1010)
    assert not verify_signature("img-1", exp + 5, sig, secret, now=1010)
    assert not verify_signature("img-1", exp, sig, "o" * 40, now=1010)
