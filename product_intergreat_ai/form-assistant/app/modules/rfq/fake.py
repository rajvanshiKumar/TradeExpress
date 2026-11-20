"""DEVELOPMENT/TEST ONLY: rule-based stand-in for the AI model, so the RFQ module can be run and
tested offline. It understands simple English/Hinglish requirement lines; it is not the real AI."""
import re
from datetime import date, timedelta

from app.ai.fake import register_fake
from app.modules.rfq.schemas import Guess, RfqExtraction
from app.validators.common import UNIT_SYNONYMS

_UNIT_WORDS = "|".join(sorted(UNIT_SYNONYMS, key=len, reverse=True))
_QTY = re.compile(rf"(?<![\w.-])(\d{{1,3}}(?:,\d{{2,3}})+|\d+)\s*({_UNIT_WORDS})?(?![\w])", re.I)
_TIME_WORDS = {"day", "days", "din", "week", "weeks", "hafte", "hafta", "month", "months", "mahine", "mahina"}
_PIN = re.compile(r"(?<!\d)[1-9]\d{5}(?!\d)")
_REL = re.compile(r"(\d+)\s*(day|days|din|week|weeks|hafte|hafta|month|months|mahine|mahina)\b", re.I)
_ISO = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")
_COUNTRIES = ["india", "uae", "usa", "uk", "nepal", "bangladesh", "sri lanka", "germany", "singapore"]


def _g(value: str | None, conf: float) -> Guess:
    return Guess(value=value, confidence=conf if value else 0.0)


def _today(context: str) -> date:
    m = re.search(r"Today's date: (\d{4}-\d{2}-\d{2})", context)
    return date.fromisoformat(m.group(1)) if m else date.today()


def _categories(context: str) -> list[tuple[str, str]]:
    return [(m.group(1), m.group(2)) for m in re.finditer(r"^- ([\w-]+): (.*)$", context, re.M)]


def _quantity(text: str) -> tuple[str | None, str | None]:
    pins = set(_PIN.findall(text))
    for m in _QTY.finditer(text):
        num, unit = m.group(1), m.group(2)
        tail = text[m.end():].strip().split(" ")[0].lower().strip(",.")
        if tail in _TIME_WORDS or (num in pins and not unit):
            continue
        if re.fullmatch(r"[A-Za-z]\d+", text[max(0, m.start() - 1):m.end()]):
            continue
        return num.replace(",", ""), unit
    return None, None


def handle(untrusted_text: str, context: str, images: object = ()) -> RfqExtraction:
    text = " ".join(untrusted_text.split())
    today = _today(context)

    qty, unit = _quantity(text)
    pin = (_PIN.findall(text) or [None])[0]

    required: str | None = None
    iso = _ISO.search(text)
    rel = _REL.search(text)
    if iso:
        required = iso.group(1)
    elif rel:
        n, word = int(rel.group(1)), rel.group(2).lower()
        days = n * (7 if word.startswith(("week", "haft")) else 30 if word.startswith(("month", "mahin")) else 1)
        required = (today + timedelta(days=days)).isoformat()

    low = text.lower()
    country = next((c for c in _COUNTRIES if re.search(rf"\b{c}\b", low)), None)

    best: tuple[int, str] | None = None
    tokens = set(re.findall(r"[a-z]{3,}", low))
    for slug, name in _categories(context):
        cat_tokens = set(re.findall(r"[a-z]{3,}", f"{slug.replace('-', ' ')} {name}".lower()))
        score = len(tokens & {t.rstrip("s") for t in cat_tokens} | tokens & cat_tokens)
        if score and (best is None or score > best[0]):
            best = (score, slug)

    title = re.split(r"[,.;\n]| mein | me | for ", text, maxsplit=1)[0].strip()[:150] or None
    return RfqExtraction(
        title=_g(title.capitalize() if title else None, 0.7),
        specifications=_g(text, 0.8),
        category_slug=_g(best[1] if best else None, 0.7),
        quantity=_g(qty, 0.9),
        unit=_g(unit or ("piece" if qty else None), 0.9 if unit else 0.55),
        delivery_pincode=_g(pin, 0.95),
        destination_country=_g(country.upper() if country in ("uae", "usa", "uk") else
                               (country.title() if country else ("India" if pin else None)),
                               0.9 if country else 0.7),
        required_by_date=_g(required, 0.85 if iso else 0.7),
    )


register_fake(RfqExtraction, handle)
