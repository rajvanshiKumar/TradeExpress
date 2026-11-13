import pytest

from app.ai.policy import (
    DEFAULT_MEDIUM,
    Routing,
    find_unsupported_claims,
    route_prediction,
)


def test_high_confidence_is_prefilled_but_still_flagged_for_review():
    r = route_prediction("color", "black", 0.95, "image", threshold=0.8)
    assert r.routing is Routing.PREFILL
    assert r.value == "black" and r.requires_review is True


def test_medium_confidence_requires_confirmation():
    r = route_prediction("color", "black", 0.6, "image", threshold=0.8)
    assert r.routing is Routing.CONFIRM and r.value == "black" and r.requires_review


def test_low_confidence_left_unfilled():
    r = route_prediction("color", "black", DEFAULT_MEDIUM - 0.01, "image", threshold=0.8)
    assert r.routing is Routing.EMPTY and r.value is None


@pytest.mark.parametrize("value", [None, "", "unknown", "N/A", []])
def test_missing_value_never_fabricated(value):
    r = route_prediction("brand", value, 0.99, "image", threshold=0.8)
    assert r.routing is Routing.EMPTY and r.value is None


@pytest.mark.parametrize("key", ["net_weight", "package_dimensions", "model_number",
                                 "certifications", "capacity_mah", "warranty_months"])
def test_sensitive_attributes_from_image_guess_never_prefilled(key):
    r = route_prediction(key, "500", 0.99, "image", threshold=0.8)
    assert r.routing is Routing.CONFIRM and r.requires_review


def test_sensitive_attribute_with_ocr_evidence_can_prefill():
    r = route_prediction("model_number", "X200", 0.97, "ocr", threshold=0.8)
    assert r.routing is Routing.PREFILL


def test_confidence_is_clamped_and_validated():
    assert route_prediction("color", "red", 1.7, "image", 0.8).confidence == 1.0
    assert route_prediction("color", "red", -1, "image", 0.8).routing is Routing.EMPTY


def test_unsupported_numeric_claims_detected():
    evidence = "ACME SoundMax X200 black bluetooth headphones"
    text = "Enjoy 40 hours of battery life and IP67 water resistance with 30mm drivers."
    claims = find_unsupported_claims(text, evidence)
    assert any("40 hours" in c for c in claims)
    assert any("IP67" in c for c in claims)
    assert any("30mm" in c.replace(" ", "") for c in claims)


def test_supported_claims_pass():
    evidence = "battery life 40 hours; IP67; drivers 30 mm"
    text = "Up to 40 hours of battery life, IP67 rated, 30mm drivers."
    assert find_unsupported_claims(text, evidence) == []


def test_certification_and_absolute_claims_flagged():
    assert find_unsupported_claims("FDA approved and CE certified", "plain bottle")
    assert find_unsupported_claims("100% waterproof", "plain bottle")
    assert find_unsupported_claims("A plain, simple bottle.", "plain bottle") == []
