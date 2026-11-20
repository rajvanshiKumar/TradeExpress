"""DEVELOPMENT/TEST ONLY: reads 'Label: value' lines from the pasted text. It cannot read images."""
from app.ai.fake import register_fake
from app.ai.fake_utils import parse_kv, pick, to_iso
from app.core.schemas import Guess
from app.modules.transport_driver.schemas import DriverExtraction


def _g(value: str | None, conf: float = 0.9) -> Guess:
    return Guess(value=value, confidence=conf if value else 0.0)


def handle(untrusted_text: str, context: str, images: object = ()) -> DriverExtraction:
    kv = parse_kv(untrusted_text)
    return DriverExtraction(
        name=_g(pick(kv, "name", "driver name")),
        licence_number=_g(pick(kv, "dl no", "licence no", "license no", "licence number")),
        licence_type=_g(pick(kv, "class", "licence type", "license type"), 0.8),
        licence_expiry_date=_g(to_iso(pick(kv, "valid till", "validity", "licence expiry", "license expiry"))),
        phone=_g(pick(kv, "phone", "mobile")),
        alternate_phone=_g(pick(kv, "alternate phone", "alt phone")),
        emergency_contact_name=_g(pick(kv, "emergency name", "emergency contact name")),
        emergency_contact_phone=_g(pick(kv, "emergency phone", "emergency contact phone")),
    )


register_fake(DriverExtraction, handle)
