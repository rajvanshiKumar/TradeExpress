import pytest

from app.services.listing import _parse_json


@pytest.mark.parametrize(("raw", "expected"), [
    ('"AKG"', "AKG"),
    ("AKG", "AKG"),                       # model forgot the JSON quotes
    ("grey and blue", "grey and blue"),
    ("30", 30),
    ('["wired"]', ["wired"]),
    ('{"value": 5, "unit": "kg"}', {"value": 5, "unit": "kg"}),
    ("true", True),
    ("null", None),
    (None, None),
    ("", None),
    ("   ", None),
])
def test_parse_json_is_lenient_for_bare_strings(raw, expected):
    assert _parse_json(raw) == expected


def test_check_content_value_supports_numeric_and_strings():
    from app.core.errors import ValidationFailed
    from app.services.listing import _check_content_value

    # Numeric fields accept float, int, or valid numeric string
    _check_content_value("gst_rate", 5.0)
    _check_content_value("gst_rate", 18)
    _check_content_value("gst_rate", "18.0")
    _check_content_value("weight_kg", 0.3)
    _check_content_value("suggested_price_inr", 999.0)

    # Invalid numeric value fails
    with pytest.raises(ValidationFailed):
        _check_content_value("gst_rate", "not-a-number")

    # Regular string field
    _check_content_value("title", "Valid Title")
    with pytest.raises(ValidationFailed):
        _check_content_value("title", 123)

    # List fields
    _check_content_value("highlights", ["Point 1", "Point 2"])
    with pytest.raises(ValidationFailed):
        _check_content_value("highlights", "not-a-list")
