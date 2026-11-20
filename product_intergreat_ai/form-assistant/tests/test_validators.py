from datetime import date

import pytest

from app.validators.common import (
    normalize_country,
    normalize_unit,
    parse_future_date,
    parse_quantity,
    valid_pincode,
)

TODAY = date(2026, 11, 13)


@pytest.mark.parametrize("raw,expected", [("500", 500), ("1,200", 1200), ("10.0", 10), (7, 7)])
def test_quantity_ok(raw, expected):
    assert parse_quantity(raw) == expected


@pytest.mark.parametrize("raw", ["0", "-5", "abc", "1.5", None, "999999999999", ""])
def test_quantity_rejected(raw):
    assert parse_quantity(raw) is None


@pytest.mark.parametrize("raw,expected", [("pcs", "piece"), ("KGS", "kg"), ("Tonnes", "ton"), ("boxes", "box")])
def test_unit_normalised(raw, expected):
    assert normalize_unit(raw) == expected


def test_unit_unknown_rejected():
    assert normalize_unit("furlong") is None


@pytest.mark.parametrize("raw,ok", [("411001", True), ("411 001", True), ("011001", False), ("41100", False),
                                    ("4110011", False), ("abcdef", False)])
def test_pincode(raw, ok):
    assert (valid_pincode(raw) is not None) is ok


def test_country():
    assert normalize_country("india") == "India"
    assert normalize_country("uae") == "UAE"
    assert normalize_country("12345") is None


def test_dates():
    assert parse_future_date("2026-11-27", TODAY)[0] == date(2026, 11, 27)
    assert parse_future_date("2026-01-01", TODAY) == (None, "date is in the past")
    assert parse_future_date("2099-01-01", TODAY)[1] == "date is unrealistically far away"
    assert parse_future_date("next week", TODAY)[1] == "not a valid YYYY-MM-DD date"
