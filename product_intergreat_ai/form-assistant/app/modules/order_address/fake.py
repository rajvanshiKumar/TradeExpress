"""DEVELOPMENT/TEST ONLY: rule-based stand-in for the AI model (not the real AI)."""
import re

from app.ai.fake import register_fake
from app.ai.fake_utils import parse_kv, pick
from app.core.schemas import Guess
from app.modules.order_address.schemas import AddressExtraction
from app.validators.india import _STATE_LOOKUP

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE = re.compile(r"(?<!\d)(?:\+?91[ -]?)?[6-9]\d{4}[ -]?\d{5}(?!\d)")
_GSTIN = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")
_PIN = re.compile(r"(?<!\d)[1-9]\d{5}(?!\d)")


def _g(value: str | None, conf: float) -> Guess:
    return Guess(value=value, confidence=conf if value else 0.0)


def handle(untrusted_text: str, context: str, images: object = ()) -> AddressExtraction:
    text = untrusted_text
    kv = parse_kv(text)
    email = (_EMAIL.search(text) or [None])[0]
    phone = (_PHONE.search(text) or [None])[0]
    gstin = (_GSTIN.search(text) or [None])[0]
    pin = (_PIN.search(re.sub(r"[+]?91[ -]?[6-9]\d{4}[ -]?\d{5}", " ", text)) or [None])[0]

    low = text.lower()
    state = next((n for n in sorted(_STATE_LOOKUP, key=len, reverse=True)
                  if len(n) > 3 and re.search(rf"\b{re.escape(n)}\b", low)), None)

    name = pick(kv, "name", "buyer name", "contact", "contact person")
    company = pick(kv, "company", "firm", "business")
    if not company:
        biz = re.compile(r"\b(pvt|ltd|llp|traders|industries)\b", re.I)
        company = next((ln.strip() for ln in text.splitlines() if biz.search(ln) and ":" not in ln), None)

    src = pick(kv, "address", "deliver to", "delivery address", "ship to")
    if not src:
        lines = [ln for ln in text.splitlines() if ln.strip() and ":" not in ln and "@" not in ln]
        src = max(lines, key=len) if lines else text
    for junk in (pin, state):
        if junk:
            src = re.sub(re.escape(junk), "", src, flags=re.I)
    src = re.sub(r"\bindia\b", "", src, flags=re.I)
    parts = [p.strip(" .-") for p in re.split(r"[,\n]", src) if p.strip(" .-")]
    landmark = next((p for p in parts if re.match(r"(near|opp|opposite|landmark)", p, re.I)), None)
    parts = [p for p in parts if p != landmark]
    city = parts[-1] if len(parts) >= 2 else None
    body = parts[:-1] if city else parts
    line1 = body[0] if body else None
    line2 = ", ".join(body[1:]) if len(body) > 1 else None

    return AddressExtraction(
        line1=_g(line1, 0.8), line2=_g(line2, 0.7), landmark=_g(landmark, 0.8), city=_g(city, 0.75),
        state=_g(state.title() if state else None, 0.85), pincode=_g(pin, 0.95),
        country=_g("India" if pin else None, 0.7),
        buyer_name=_g(name, 0.85), buyer_phone=_g(phone, 0.95), buyer_email=_g(email, 0.95),
        buyer_company=_g(company, 0.8), buyer_gstin=_g(gstin, 0.9),
    )


register_fake(AddressExtraction, handle)
