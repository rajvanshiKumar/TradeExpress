"""Confidence routing and anti-hallucination checks. Pure functions, no I/O.

Thresholds are routing thresholds, not calibrated probabilities.
"""
import re
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

DEFAULT_MEDIUM = 0.5
TRUSTED_SOURCES = {"ocr", "seller", "document", "catalog"}
# Values that must never be taken from a visual guess alone.
SENSITIVE_KEYS = {
    "net_weight", "weight_per_unit", "package_dimensions", "model_number", "part_number",
    "certifications", "standard_compliance", "capacity_mah", "warranty_months", "voltage",
    "power_rating", "max_load_kg", "ram_gb", "storage_gb", "purity", "grade", "barcode", "isbn",
    "expiry_date", "ingredients", "net_content", "volume", "battery_life", "dosage_form",
}
EMPTY_MARKERS = {"", "unknown", "n/a", "na", "not visible", "not specified", "unspecified", "null"}


class Routing(StrEnum):
    PREFILL = "prefill"      # high confidence: pre-filled, still flagged for review
    CONFIRM = "confirm"      # medium confidence: seller must confirm
    EMPTY = "empty"          # low confidence / no evidence: left unfilled


@dataclass
class Routed:
    attribute_key: str
    value: Any
    confidence: float
    source: str
    routing: Routing
    requires_review: bool
    reason: str


def _is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip().lower() in EMPTY_MARKERS
    if isinstance(value, list | dict):
        return len(value) == 0
    return False


def route_prediction(
    key: str, value: Any, confidence: float, source: str, threshold: float,
    medium: float = DEFAULT_MEDIUM,
) -> Routed:
    conf = max(0.0, min(1.0, float(confidence)))
    if _is_empty(value):
        return Routed(key, None, conf, source, Routing.EMPTY, False, "no evidence for a value")
    if conf < medium:
        return Routed(key, None, conf, source, Routing.EMPTY, False, "confidence below minimum")
    if key in SENSITIVE_KEYS and source not in TRUSTED_SOURCES:
        return Routed(key, value, conf, source, Routing.CONFIRM, True,
                      "sensitive attribute without verifiable evidence (visual guess)")
    if conf >= threshold:
        return Routed(key, value, conf, source, Routing.PREFILL, True, "high confidence")
    return Routed(key, value, conf, source, Routing.CONFIRM, True, "medium confidence")


_UNITS = (r"hours?|hrs?|mah|gb|tb|mb|kg|mg|g|cm|mm|ml|kw|hz|ghz|rpm|mp|inch|years?|months?"
          r"|days?|w|v|l|m|%")
_NUM_UNIT = re.compile(rf"(?<![\w.])(\d+(?:\.\d+)?)\s?({_UNITS})(?![a-z])", re.I)
_IP = re.compile(r"\bIP\s?\d{2}\b", re.I)
_CERT = re.compile(r"\b(FDA|CE|UL|RoHS|BIS|FCC|HACCP|GMP|ISO\s?\d*)\b")
_ABSOLUTE = ("waterproof", "clinically proven", "medical grade", "hypoallergenic",
             "anti-bacterial", "antibacterial", "guaranteed", "certified", "approved")


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", text.lower())


def find_unsupported_claims(text: str, evidence: str) -> list[str]:
    """Return claims in generated text that have no support in the evidence text."""
    ev = _norm(evidence)
    ev_lower = evidence.lower()
    claims: list[str] = []
    for rx in (_NUM_UNIT, _IP, _CERT):
        for m in rx.finditer(text):
            if _norm(m.group(0)) not in ev:
                claims.append(m.group(0))
    for word in _ABSOLUTE:
        if word in text.lower() and word not in ev_lower:
            claims.append(word)
    return list(dict.fromkeys(claims))
