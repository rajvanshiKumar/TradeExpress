"""Pure validation of attribute values against a dynamic (DB-defined) attribute spec."""
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlparse

WEIGHT_UNITS = {"g", "kg", "mg", "lb", "oz", "t"}
LENGTH_UNITS = {"mm", "cm", "m", "in", "ft"}


@dataclass
class AttributeSpec:
    key: str
    data_type: str
    required: bool = False
    allowed_values: list[Any] | None = None
    unit: str | None = None
    rules: dict[str, Any] = field(default_factory=dict)


def _is_num(v: Any) -> bool:
    return isinstance(v, int | float | Decimal) and not isinstance(v, bool)


def _to_decimal(v: Any) -> Decimal | None:
    if isinstance(v, bool):
        return None
    try:
        return Decimal(str(v))
    except (InvalidOperation, ValueError):
        return None


def _check_type(spec: AttributeSpec, v: Any) -> list[str]:
    t = spec.data_type
    if t == "string":
        return [] if isinstance(v, str) else ["must be a string"]
    if t == "integer":
        return [] if isinstance(v, int) and not isinstance(v, bool) else ["must be an integer"]
    if t == "decimal":
        return [] if _to_decimal(v) is not None else ["must be a decimal number"]
    if t == "boolean":
        return [] if isinstance(v, bool) else ["must be a boolean"]
    if t == "date":
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(v)):
            return ["must be an ISO date (YYYY-MM-DD)"]
        try:
            date.fromisoformat(str(v))
        except ValueError:
            return ["must be a valid calendar date"]
        return []
    if t == "url":
        p = urlparse(str(v))
        return [] if p.scheme in ("http", "https") and p.netloc else ["must be an http(s) URL"]
    if t == "currency":
        ok = isinstance(v, str) and re.fullmatch(r"[A-Z]{3}", v)
        return [] if ok else ["must be a 3-letter ISO currency code"]
    if t in ("measurement", "weight"):
        if not isinstance(v, dict) or not _is_num(v.get("value")) or not isinstance(
            v.get("unit"), str
        ):
            return ["must be an object with numeric 'value' and string 'unit'"]
        if t == "weight" and v["unit"] not in WEIGHT_UNITS:
            return [f"unit must be one of {sorted(WEIGHT_UNITS)}"]
        allowed = spec.rules.get("units")
        if allowed and v["unit"] not in allowed:
            return [f"unit must be one of {allowed}"]
        return []
    if t == "dimension":
        if not isinstance(v, dict) or not all(
            _is_num(v.get(k)) for k in ("length", "width", "height")
        ):
            return ["must have numeric length, width and height"]
        if v.get("unit") not in LENGTH_UNITS:
            return [f"unit must be one of {sorted(LENGTH_UNITS)}"]
        return []
    if t == "enum":
        return [] if v in (spec.allowed_values or []) else ["not an allowed value"]
    if t == "multi_select":
        if not isinstance(v, list):
            return ["must be a list"]
        bad = [x for x in v if x not in (spec.allowed_values or [])]
        return [f"not allowed: {bad}"] if bad else []
    if t == "array":
        return [] if isinstance(v, list) else ["must be an array"]
    if t == "object":
        return [] if isinstance(v, dict) else ["must be an object"]
    return [f"unknown data type '{t}'"]


def _check_rules(spec: AttributeSpec, v: Any) -> list[str]:
    r, errs = spec.rules, []
    num = _to_decimal(v) if spec.data_type in ("integer", "decimal") else None
    if num is not None:
        if "min" in r and num < Decimal(str(r["min"])):
            errs.append(f"must be >= {r['min']}")
        if "max" in r and num > Decimal(str(r["max"])):
            errs.append(f"must be <= {r['max']}")
    if isinstance(v, str):
        if "max_length" in r and len(v) > r["max_length"]:
            errs.append(f"must be at most {r['max_length']} characters")
        if "min_length" in r and len(v) < r["min_length"]:
            errs.append(f"must be at least {r['min_length']} characters")
        if "regex" in r and not re.fullmatch(r["regex"], v):
            errs.append("does not match required format")
    return errs


def validate_value(spec: AttributeSpec, value: Any) -> list[str]:
    if value is None or value == "":
        return [f"{spec.key} is required"] if spec.required else []
    errs = _check_type(spec, value)
    return errs or _check_rules(spec, value)
