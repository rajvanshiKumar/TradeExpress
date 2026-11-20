"""Calls the REAL provider configured in .env with synthetic, fictional documents (needs Pillow).
Skipped unless ASSIST_RUN_LIVE=1.   Run:  ASSIST_RUN_LIVE=1 pytest tests/test_live_modules.py -s"""
import base64
import io
import os

import pytest

pytestmark = pytest.mark.skipif(os.getenv("ASSIST_RUN_LIVE") != "1", reason="live test (set ASSIST_RUN_LIVE=1)")
PIL = pytest.importorskip("PIL")


def _doc(lines: list[str]) -> dict:
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (1000, 120 + 46 * len(lines)), "white")
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=28)
    for i, line in enumerate(lines):
        draw.text((30, 30 + 46 * i), line, fill="black", font=font)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return {"mime_type": "image/png", "data_base64": base64.b64encode(buf.getvalue()).decode()}


def _provider():
    from app.ai.factory import build_provider
    from app.core.config import Settings

    p = build_provider(Settings())  # type: ignore[call-arg]
    assert p is not None and p.name != "fake"
    return p


async def test_live_order_address_text():
    from app.modules.order_address import service
    from app.modules.order_address.schemas import AddressAssistIn

    text = ("Hi, please deliver to Rahul Sharma, Sharma Traders Pvt Ltd, Flat 4B Shiv Residency, Baner Road, "
            "near City Mall, Pune Maharashtra 411045. Mobile 98765 43210, rahul@sharmatraders.in. "
            "GSTIN 27AAPFU0939F1ZV. My aadhaar is 1234 5678 9012.")
    out = await service.assist(_provider(), AddressAssistIn(text=text))
    s = out.suggestions
    print({k: v.value for k, v in s.items()}, out.warnings)
    assert s["buyerPhone"].value == "9876543210"
    assert s["buyerGstin"].value == "27AAPFU0939F1ZV"
    assert s["deliveryAddress.pincode"].value == "411045"
    assert s["deliveryAddress.state"].value == "Maharashtra"
    assert any("Aadhaar-like" in w for w in out.warnings)


async def test_live_vehicle_documents():
    from app.modules.transport_vehicle import service
    from app.modules.transport_vehicle.schemas import VehicleAssistIn

    rc = _doc(["CERTIFICATE OF REGISTRATION", "Regn. No: MH12AB1234", "Owner: SHARMA TRANSPORT PVT LTD",
               "Maker: TATA MOTORS LTD", "Model: LPT 1109", "Mfg Date: 05/2019", "Regn. Validity: 14/03/2034"])
    ins = _doc(["MOTOR INSURANCE POLICY", "Policy No: POL/2026-7788", "Vehicle: MH12AB1234",
                "Policy Period: 01/04/2026 to 31/03/2027"])
    out = await service.assist(_provider(), VehicleAssistIn(images=[rc, ins], company_name="Sharma Transport",
                                                            today="2026-11-13"))  # type: ignore[arg-type]
    s = out.suggestions
    print({k: (v.value, v.routing) for k, v in s.items()}, out.warnings)
    assert s["vehicleNumber"].value == "MH12AB1234"
    assert s["rcExpiryDate"].value == "2034-03-14"
    assert s["insuranceExpiryDate"].value == "2027-03-31"
    assert s["yearOfManufacture"].value == 2019
    assert "isVerified" not in s


async def test_live_driver_licence():
    from app.modules.transport_driver import service
    from app.modules.transport_driver.schemas import DriverAssistIn

    dl = _doc(["INDIAN UNION DRIVING LICENCE", "DL No: MH12 20190001234", "Name: RAMESH KUMAR",
               "Class of vehicle: LMV, HGMV", "Validity (NT): 19-08-2039", "Validity (TR): 19-08-2028",
               "Aadhaar: 1234 5678 9012"])
    out = await service.assist(_provider(), DriverAssistIn(
        images=[dl], text="Phone 98765 43210, emergency contact Sunita Kumar 99887 76655",
        today="2026-11-13"))  # type: ignore[arg-type]
    s = out.suggestions
    print({k: (v.value, v.routing) for k, v in s.items()}, out.warnings)
    assert s["licenseNumber"].value == "MH1220190001234"
    assert s["licenseType"].value == "COMMERCIAL_HEAVY"
    assert s["licenseExpiryDate"].value == "2028-08-19"
    assert s["phone"].value == "9876543210"
    assert not any("1234 5678 9012" in str(v.value) for v in s.values())
