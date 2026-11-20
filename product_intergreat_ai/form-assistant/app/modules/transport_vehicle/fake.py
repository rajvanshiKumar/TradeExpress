"""DEVELOPMENT/TEST ONLY: reads 'Label: value' lines from the pasted text. It cannot read images,
so with images only it returns nothing. Use a real provider to test photo extraction."""
import re

from app.ai.fake import register_fake
from app.ai.fake_utils import parse_kv, pick, to_iso
from app.core.schemas import Guess
from app.modules.transport_vehicle.schemas import VehicleExtraction


def _g(value: str | None, conf: float = 0.9) -> Guess:
    return Guess(value=value, confidence=conf if value else 0.0)


def handle(untrusted_text: str, context: str, images: object = ()) -> VehicleExtraction:
    kv = parse_kv(untrusted_text)
    cap = pick(kv, "capacity", "payload", "capacity tons")
    cap_num = re.search(r"\d+(?:\.\d+)?", cap or "")
    return VehicleExtraction(
        vehicle_number=_g(pick(kv, "reg no", "registration no", "vehicle no", "vehicle number")),
        make=_g(pick(kv, "make", "manufacturer")), model=_g(pick(kv, "model")),
        year_of_manufacture=_g(pick(kv, "year", "mfg year", "year of manufacture")),
        owner_name=_g(pick(kv, "owner", "owner name")),
        rc_number=_g(pick(kv, "rc no", "rc number")),
        rc_expiry_date=_g(to_iso(pick(kv, "rc valid till", "rc expiry"))),
        insurance_number=_g(pick(kv, "insurance no", "policy no")),
        insurance_expiry_date=_g(to_iso(pick(kv, "insurance valid till", "insurance expiry"))),
        fitness_expiry_date=_g(to_iso(pick(kv, "fitness valid till", "fitness expiry"))),
        permit_number=_g(pick(kv, "permit no", "permit number")),
        permit_type=_g(pick(kv, "permit type")),
        permit_expiry_date=_g(to_iso(pick(kv, "permit valid till", "permit expiry"))),
        puc_expiry_date=_g(to_iso(pick(kv, "puc valid till", "puc expiry"))),
        vehicle_type=_g(pick(kv, "vehicle type"), 0.8), body_type=_g(pick(kv, "body type"), 0.8),
        capacity_tons=_g(cap_num.group(0) if cap_num else None),
        gps_provider=_g(pick(kv, "gps provider")), gps_imei=_g(pick(kv, "imei", "gps imei")),
    )


register_fake(VehicleExtraction, handle)
