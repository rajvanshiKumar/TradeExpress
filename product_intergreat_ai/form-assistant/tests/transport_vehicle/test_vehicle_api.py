from app.core.schemas import Guess
from app.modules.transport_vehicle.schemas import VehicleExtraction
from tests.conftest import TODAY, Scripted, fake_image

URL = "/v1/transport-vehicle/assist"
TEXT = (
    "Reg No: MH-12-AB-1234\nMake: Tata Motors\nModel: LPT 1109\nYear: 2019\nOwner: Sharma Transport Pvt Ltd\n"
    "RC Valid Till: 15/03/2034\nInsurance No: POL/2026-7788\nInsurance Valid Till: 31/03/2027\n"
    "Fitness Valid Till: 10/01/2026\nPermit No: NP-77881\nPermit Type: National\nPermit Valid Till: 30/06/2027\n"
    "PUC Valid Till: 01/05/2027\nVehicle Type: Open Truck\nBody Type: open\nCapacity: 9 tons\n"
    "IMEI: 490154203237518\nGPS Provider: TrackIt"
)


def post(client, headers, **body):
    body.setdefault("text", TEXT)
    body.setdefault("today", TODAY)
    return client.post(URL, json=body, headers=headers)


def test_requires_api_key(client):
    assert client.post(URL, json={"text": TEXT}).status_code == 401


def test_happy_path(client, headers):
    r = post(client, headers, company_name="Sharma Transport")
    assert r.status_code == 200, r.text
    s = r.json()["suggestions"]
    assert s["vehicleNumber"]["value"] == "MH12AB1234" and s["vehicleNumber"]["routing"] == "prefill"
    assert s["make"]["value"] == "Tata Motors" and s["yearOfManufacture"]["value"] == 2019
    assert s["rcExpiryDate"]["value"] == "2034-03-15"
    assert s["insuranceExpiryDate"]["value"] == "2027-03-31"
    assert s["permitType"]["value"] == "NATIONAL"
    assert s["insuranceNumber"]["value"] == "POL/2026-7788"
    assert s["ownershipType"]["value"] == "OWNED" and s["ownershipType"]["routing"] == "confirm"


def test_inferred_fields_always_need_confirmation(client, headers):
    s = post(client, headers).json()["suggestions"]
    for f in ("vehicleType", "bodyType", "capacityTons", "gpsImei"):
        assert s[f]["routing"] == "confirm", f
    assert s["capacityTons"]["value"] == 9.0 and s["bodyType"]["value"] == "OPEN"


def test_expired_document_is_flagged(client, headers):
    r = post(client, headers).json()
    assert r["suggestions"]["fitnessExpiryDate"]["routing"] == "confirm"
    assert r["suggestions"]["fitnessExpiryDate"]["reason"].startswith("Expired")
    assert any("fitnessExpiryDate" in w for w in r["warnings"])


def test_ownership_needs_matching_company(client, headers):
    assert "ownershipType" not in post(client, headers, company_name="Totally Different Ltd").json()["suggestions"]
    r = post(client, headers).json()
    assert "ownershipType" not in r["suggestions"] and r["skipped"]["ownershipType"].startswith("send company_name")


def test_never_touches_verification_or_status(client, headers):
    cfg = client.get("/v1/transport-vehicle/fields", headers=headers).json()
    excluded = {f["key"] for f in cfg["fields"] if not f["ai_fillable"]}
    assert {"isVerified", "status", "cargoVolumeCbm"} <= excluded
    keys = set(post(client, headers).json()["suggestions"])
    assert not keys & {"isVerified", "status", "verifiedAt", "verificationNotes", "currentLocation"}


def test_images_are_decoded_and_sent_to_the_provider(app, client, headers):
    app.state.ai_provider = Scripted(VehicleExtraction(vehicle_number=Guess(value="mh12ab1234", confidence=0.95)))
    r = client.post(URL, json={"images": [fake_image("image/jpeg"), fake_image("image/png")]}, headers=headers)
    assert r.status_code == 200 and r.json()["suggestions"]["vehicleNumber"]["value"] == "MH12AB1234"
    assert [i.mime_type for i in app.state.ai_provider.last_images] == ["image/jpeg", "image/png"]


def test_bad_images_and_empty_request(client, headers):
    bad = {"mime_type": "image/png", "data_base64": "!" * 200}
    r = client.post(URL, json={"images": [bad]}, headers=headers)
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_image"
    wrong = {"mime_type": "image/jpeg", "data_base64": fake_image("image/png")["data_base64"]}
    assert client.post(URL, json={"images": [wrong]}, headers=headers).status_code == 422
    assert client.post(URL, json={}, headers=headers).status_code == 422
    assert client.post(URL, json={"images": [fake_image()] * 5}, headers=headers).status_code == 422
    pdf = {"mime_type": "application/pdf", "data_base64": "A" * 200}
    assert client.post(URL, json={"images": [pdf]}, headers=headers).status_code == 422


def test_bad_model_output_is_rejected(app, client, headers):
    ext = VehicleExtraction(
        vehicle_number=Guess(value="HELLO", confidence=0.99), year_of_manufacture=Guess(value="1850", confidence=0.99),
        rc_expiry_date=Guess(value="15/03/2034", confidence=0.99),       # not ISO
        insurance_expiry_date=Guess(value="1990-01-01", confidence=0.99),  # unrealistic
        vehicle_type=Guess(value="Spaceship", confidence=0.99), body_type=Guess(value="BOAT", confidence=0.99),
        permit_type=Guess(value="LOCAL", confidence=0.99), gps_imei=Guess(value="490154203237519", confidence=0.99),
        capacity_tons=Guess(value="9000", confidence=0.99), make=Guess(value="Tata", confidence=0.2),
    )
    app.state.ai_provider = Scripted(ext)
    s = post(client, headers).json()["suggestions"]
    assert s == {}


def test_provider_failure_and_missing_provider(app, client, headers):
    app.state.ai_provider.fail = True
    assert post(client, headers).status_code == 502
    app.state.ai_provider = None
    assert post(client, headers).status_code == 503
