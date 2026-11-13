import pytest

from app.services.attribute_validation import AttributeSpec, validate_value


def spec(data_type, **kw):
    return AttributeSpec(key="k", data_type=data_type, **kw)


@pytest.mark.parametrize(
    ("data_type", "value"),
    [
        ("string", "abc"),
        ("integer", 5),
        ("decimal", "3.14"),
        ("boolean", True),
        ("date", "2026-01-31"),
        ("url", "https://example.com/x"),
        ("currency", "USD"),
        ("measurement", {"value": 5, "unit": "cm"}),
        ("dimension", {"length": 1, "width": 2, "height": 3, "unit": "cm"}),
        ("weight", {"value": 1.5, "unit": "kg"}),
        ("array", [1, 2]),
        ("object", {"a": 1}),
    ],
)
def test_valid_values(data_type, value):
    assert validate_value(spec(data_type), value) == []


@pytest.mark.parametrize(
    ("data_type", "value"),
    [
        ("integer", "x"),
        ("integer", True),
        ("decimal", "abc"),
        ("boolean", "yes"),
        ("date", "31-01-2026"),
        ("url", "javascript:alert(1)"),
        ("currency", "usd1"),
        ("measurement", {"value": "x", "unit": "cm"}),
        ("weight", {"value": 1, "unit": "parsec"}),
        ("dimension", {"length": 1}),
        ("array", "nope"),
        ("object", [1]),
    ],
)
def test_invalid_values(data_type, value):
    assert validate_value(spec(data_type), value)


def test_required_missing():
    assert validate_value(spec("string", required=True), None)
    assert validate_value(spec("string", required=False), None) == []


def test_enum_allowed_values():
    s = spec("enum", allowed_values=["red", "blue"])
    assert validate_value(s, "red") == []
    assert validate_value(s, "green")


def test_multi_select():
    s = spec("multi_select", allowed_values=["a", "b"])
    assert validate_value(s, ["a", "b"]) == []
    assert validate_value(s, ["a", "z"])
    assert validate_value(s, "a")


def test_rules_min_max_regex_length():
    assert validate_value(spec("integer", rules={"min": 1, "max": 10}), 11)
    assert validate_value(spec("integer", rules={"min": 1, "max": 10}), 0)
    assert validate_value(spec("integer", rules={"min": 1, "max": 10}), 5) == []
    assert validate_value(spec("string", rules={"regex": r"^\d{13}$"}), "123")
    assert validate_value(spec("string", rules={"regex": r"^\d{13}$"}), "1234567890123") == []
    assert validate_value(spec("string", rules={"max_length": 3}), "abcd")


def test_unit_must_be_allowed_for_measurement():
    s = spec("measurement", unit="cm", rules={"units": ["cm", "mm"]})
    assert validate_value(s, {"value": 1, "unit": "inch"})
    assert validate_value(s, {"value": 1, "unit": "mm"}) == []
