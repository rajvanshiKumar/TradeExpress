"""India-specific validators: contacts, tax ids, vehicle and licence documents.
Every value the AI model returns passes through one of these before it reaches a form."""
import re
from datetime import date, timedelta

from app.validators.common import clean_text

# ---------------------------------------------------------------- contacts / tax ids

_EMAIL = re.compile(r"^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$")
_GSTIN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"

GST_STATES: dict[str, str] = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
    "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
    "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka",
    "30": "Goa", "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh",
}
_STATE_ALIASES = {
    "orissa": "Odisha", "uttaranchal": "Uttarakhand", "nct of delhi": "Delhi", "new delhi": "Delhi",
    "pondicherry": "Puducherry", "jammu & kashmir": "Jammu and Kashmir",
    "andaman & nicobar islands": "Andaman and Nicobar Islands", "up": "Uttar Pradesh",
    "mp": "Madhya Pradesh", "tn": "Tamil Nadu", "ap": "Andhra Pradesh",
}
_STATE_LOOKUP = {n.lower(): n for n in GST_STATES.values()} | _STATE_ALIASES


def normalize_phone(value: object) -> str | None:
    """Indian mobile only: returns the 10-digit number (no +91)."""
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits if re.fullmatch(r"[6-9][0-9]{9}", digits) else None


def valid_email(value: object) -> str | None:
    if value is None:
        return None
    v = str(value).strip().lower()
    return v if _EMAIL.fullmatch(v) else None


def gstin_checksum_ok(gstin: str) -> bool:
    total = 0
    for i, ch in enumerate(gstin[:14]):
        val = _GST_CHARS.index(ch) * (1 if i % 2 == 0 else 2)
        total += val // 36 + val % 36
    return _GST_CHARS[(36 - total % 36) % 36] == gstin[14]


def valid_gstin(value: object) -> str | None:
    if value is None:
        return None
    v = re.sub(r"\s", "", str(value)).upper()
    if not _GSTIN.fullmatch(v) or v[:2] not in GST_STATES or not gstin_checksum_ok(v):
        return None
    return v


def normalize_state(value: object) -> str | None:
    text = clean_text(value, 60)
    return _STATE_LOOKUP.get(text.lower().replace(".", "")) if text else None


# ---------------------------------------------------------------- government ids (privacy)

_AADHAAR_LIKE = re.compile(r"(?<!\d)\d{4}[ -]?\d{4}[ -]?\d{4}(?!\d)")
_PHONE_WITH_91 = re.compile(r"91[6-9][0-9]{9}")


def redact_government_ids(text: str) -> str:
    """Aadhaar-like numbers (12 digits, plain or grouped 4-4-4) never go to the AI provider.
    A plain 91 + mobile number is a phone, not an Aadhaar, and is kept."""
    def repl(m: re.Match[str]) -> str:
        digits = re.sub(r"\D", "", m.group(0))
        return m.group(0) if _PHONE_WITH_91.fullmatch(digits) else "[redacted-id]"

    return _AADHAAR_LIKE.sub(repl, text)


def looks_like_aadhaar(text: str) -> bool:
    return redact_government_ids(text) != text


# ---------------------------------------------------------------- transport documents

_VEHICLE = re.compile(r"^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{4}$")
_VEHICLE_BH = re.compile(r"^[0-9]{2}BH[0-9]{4}[A-Z]{1,2}$")


def normalize_vehicle_number(value: object) -> str | None:
    """Compact uppercase form without separators, e.g. 'MH-12-AB-1234' -> 'MH12AB1234'."""
    if value is None:
        return None
    v = re.sub(r"[^A-Za-z0-9]", "", str(value)).upper()
    return v if _VEHICLE.fullmatch(v) or _VEHICLE_BH.fullmatch(v) else None


def valid_imei(value: object) -> str | None:
    if value is None:
        return None
    v = re.sub(r"[\s-]", "", str(value))
    if not re.fullmatch(r"[0-9]{15}", v):
        return None
    total = 0
    for i, ch in enumerate(reversed(v)):
        d = int(ch)
        if i % 2 == 1:
            d *= 2
            d -= 9 if d > 9 else 0
        total += d
    return v if total % 10 == 0 else None


def normalize_licence_number(value: object) -> str | None:
    if value is None:
        return None
    v = re.sub(r"[^A-Za-z0-9]", "", str(value)).upper()
    ok = 12 <= len(v) <= 17 and v[:2].isalpha() and sum(c.isdigit() for c in v) >= 9
    return v if ok else None


def clean_identifier(value: object, min_len: int = 4, max_len: int = 40) -> str | None:
    """Policy / permit / RC numbers: letters, digits, space, / and - only."""
    text = clean_text(value, max_len)
    if not text or not re.fullmatch(r"[A-Za-z0-9/ -]+", text) or len(text) < min_len:
        return None
    return text.upper()


def parse_document_date(value: object, today: date) -> tuple[date | None, str | None]:
    """Validity dates on documents. Past dates are accepted (the document may simply be
    expired); the caller adds a note. Returns (date, None) or (None, reason)."""
    if value is None:
        return None, None
    try:
        d = date.fromisoformat(str(value).strip()[:10])
    except ValueError:
        return None, "not a valid YYYY-MM-DD date"
    if d < date(2000, 1, 1) or d > today + timedelta(days=365 * 30):
        return None, "date is not realistic"
    return d, None


_NAME_NOISE = {"pvt", "ltd", "private", "limited", "and", "co", "company"}


def similar_names(a: str, b: str, threshold: float = 0.6) -> bool:
    ta = set(re.findall(r"[a-z]{2,}", a.lower())) - _NAME_NOISE
    tb = set(re.findall(r"[a-z]{2,}", b.lower())) - _NAME_NOISE
    if not ta or not tb:
        return False
    return len(ta & tb) / min(len(ta), len(tb)) >= threshold
