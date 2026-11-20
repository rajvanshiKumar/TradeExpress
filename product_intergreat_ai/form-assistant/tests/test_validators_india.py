from datetime import date

import pytest

from app.core.errors import AppError
from app.validators.images import ImageIn, decode_images
from app.validators.india import (
    clean_identifier,
    looks_like_aadhaar,
    normalize_licence_number,
    normalize_phone,
    normalize_state,
    normalize_vehicle_number,
    parse_document_date,
    redact_government_ids,
    similar_names,
    valid_email,
    valid_gstin,
    valid_imei,
)
from tests.conftest import fake_image

TODAY = date(2026, 11, 13)


def test_gstin_format_and_checksum():
    assert valid_gstin("27AAPFU0939F1ZV") == "27AAPFU0939F1ZV"
    assert valid_gstin("27 aapfu0939f1zv") == "27AAPFU0939F1ZV"
    assert valid_gstin("27AAPFU0939F1ZX") is None          # bad checksum
    assert valid_gstin("99AAPFU0939F1ZV") is None          # unknown state code
    assert valid_gstin("not-a-gstin") is None


def test_imei_luhn():
    assert valid_imei("490154203237518") == "490154203237518"
    assert valid_imei("490154203237519") is None
    assert valid_imei("12345") is None


@pytest.mark.parametrize("raw,expected", [("+91 98765-43210", "9876543210"), ("09876543210", "9876543210"),
                                          ("919876543210", "9876543210"), ("9876543210", "9876543210"),
                                          ("1234567890", None), ("98765", None)])
def test_phone(raw, expected):
    assert normalize_phone(raw) == expected


def test_email():
    assert valid_email("Rahul@Example.COM") == "rahul@example.com"
    assert valid_email("rahul@") is None


@pytest.mark.parametrize("raw,expected", [("maharashtra", "Maharashtra"), ("Orissa", "Odisha"),
                                          ("NCT of Delhi", "Delhi"), ("Narnia", None)])
def test_state(raw, expected):
    assert normalize_state(raw) == expected


@pytest.mark.parametrize("raw,expected", [("MH-12-AB-1234", "MH12AB1234"), ("mh12ab1234", "MH12AB1234"),
                                          ("DL1CAB1234", "DL1CAB1234"), ("22BH1234AA", "22BH1234AA"),
                                          ("1234", None), ("hello", None)])
def test_vehicle_number(raw, expected):
    assert normalize_vehicle_number(raw) == expected


def test_licence_number():
    assert normalize_licence_number("MH12 20190001234") == "MH1220190001234"
    assert normalize_licence_number("abc") is None


def test_identifier():
    assert clean_identifier("pol/2026-77") == "POL/2026-77"
    assert clean_identifier("ab") is None and clean_identifier("a;b;c;d;e") is None


def test_aadhaar_redaction_keeps_phones():
    t = "aadhaar 1234 5678 9012, also 123456789012, phone 919876543210, mobile 9876543210"
    out = redact_government_ids(t)
    assert out.count("[redacted-id]") == 2
    assert "919876543210" in out and "9876543210" in out
    assert looks_like_aadhaar("1234-5678-9012") and not looks_like_aadhaar("call 9876543210")


def test_document_dates_allow_expired():
    assert parse_document_date("2025-01-01", TODAY)[0] == date(2025, 1, 1)
    assert parse_document_date("1990-01-01", TODAY)[1] == "date is not realistic"
    assert parse_document_date("31/12/2026", TODAY)[1] == "not a valid YYYY-MM-DD date"


def test_similar_names():
    assert similar_names("Sharma Transport Pvt Ltd", "SHARMA TRANSPORT")
    assert not similar_names("Rahul Verma", "Sharma Transport Pvt Ltd")


def test_decode_images_ok_and_errors():
    out = decode_images([ImageIn(**fake_image("image/png")), ImageIn(**fake_image("image/jpeg")),
                         ImageIn(**fake_image("image/webp"))])
    assert [i.mime_type for i in out] == ["image/png", "image/jpeg", "image/webp"]
    with pytest.raises(AppError, match="not valid base64"):
        decode_images([ImageIn(mime_type="image/png", data_base64="!" * 200)])
    wrong = fake_image("image/png")
    with pytest.raises(AppError, match="does not match"):
        decode_images([ImageIn(mime_type="image/jpeg", data_base64=wrong["data_base64"])])
    with pytest.raises(AppError, match="At most"):
        decode_images([ImageIn(**fake_image())] * 5)
