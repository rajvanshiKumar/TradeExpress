"""Deterministic validators shared by all modules. AI output is never trusted: every value the
model returns passes through one of these before it reaches the form."""
import re
from datetime import date, timedelta

UNIT_SYNONYMS: dict[str, str] = {
    "piece": "piece", "pieces": "piece", "pc": "piece", "pcs": "piece", "nos": "piece",
    "no": "piece", "unit": "piece", "units": "piece", "number": "piece", "numbers": "piece",
    "kg": "kg", "kgs": "kg", "kilogram": "kg", "kilograms": "kg", "kilo": "kg",
    "ton": "ton", "tons": "ton", "tonne": "ton", "tonnes": "ton", "mt": "ton",
    "meter": "meter", "meters": "meter", "metre": "meter", "metres": "meter", "mtr": "meter",
    "litre": "litre", "litres": "litre", "liter": "litre", "liters": "litre", "ltr": "litre",
    "box": "box", "boxes": "box", "carton": "box", "cartons": "box",
    "set": "set", "sets": "set",
    "pair": "pair", "pairs": "pair",
    "dozen": "dozen", "dozens": "dozen",
    "roll": "roll", "rolls": "roll",
    "bag": "bag", "bags": "bag",
    "packet": "pack", "packets": "pack", "pack": "pack", "packs": "pack",
}
ALLOWED_UNITS = sorted(set(UNIT_SYNONYMS.values()))
MAX_QUANTITY = 100_000_000

_PINCODE = re.compile(r"^[1-9][0-9]{5}$")
_COUNTRY = re.compile(r"^[A-Za-z][A-Za-z .,'()-]{1,58}$")


def clean_text(value: object, max_len: int) -> str | None:
    if value is None:
        return None
    text = re.sub(r"[ \t]+", " ", str(value)).strip()
    return text[:max_len].strip() or None


def parse_quantity(value: object) -> int | None:
    if value is None:
        return None
    raw = str(value).strip().replace(",", "")
    m = re.fullmatch(r"(\d+)(?:\.0+)?", raw)
    if not m:
        return None
    qty = int(m.group(1))
    return qty if 1 <= qty <= MAX_QUANTITY else None


def normalize_unit(value: object) -> str | None:
    if value is None:
        return None
    return UNIT_SYNONYMS.get(str(value).strip().lower().rstrip("."))


def valid_pincode(value: object) -> str | None:
    if value is None:
        return None
    raw = re.sub(r"\s", "", str(value))
    return raw if _PINCODE.fullmatch(raw) else None


def normalize_country(value: object) -> str | None:
    text = clean_text(value, 60)
    if not text or not _COUNTRY.fullmatch(text):
        return None
    return text.upper() if len(text) <= 3 else text.title()


def parse_future_date(value: object, today: date, max_years: int = 5) -> tuple[date | None, str | None]:
    """Returns (date, None) or (None, reason)."""
    if value is None:
        return None, None
    try:
        d = date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        return None, "not a valid YYYY-MM-DD date"
    if d < today:
        return None, "date is in the past"
    if d > today + timedelta(days=365 * max_years):
        return None, "date is unrealistically far away"
    return d, None
