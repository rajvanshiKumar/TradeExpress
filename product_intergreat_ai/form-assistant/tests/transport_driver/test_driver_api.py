from app.core.schemas import Guess
from app.modules.transport_driver.schemas import DriverExtraction
from tests.conftest import TODAY, Scripted, fake_image

URL = "/v1/transport-driver/assist"
TEXT = (
    "Name: Ramesh Kumar\nDL No: MH12 20190001234\nClass: COMMERCIAL_HEAVY\nValid Till: 20/08/2028\n"
    "Phone: 98765 43210\nAlternate Phone: 9123456780\nEmergency Name: Sunita Kumar\nEmergency Phone: 9988776655"
)


def post(client, headers, **body):
    body.setdefault("text", TEXT)
    body.setdefault("today", TODAY)
    return client.post(URL, json=body, headers=headers)


def test_requires_api_key(client):
    assert client.post(URL, json={"text": TEXT}).status_code == 401


def test_happy_path(client, headers):
    r = post(client, headers)
    assert r.status_code == 200, r.text
    s = r.json()["suggestions"]
    assert s["name"]["value"] == "Ramesh Kumar"
    assert s["licenseNumber"]["value"] == "MH1220190001234"
    assert s["licenseExpiryDate"]["value"] == "2028-08-20"
    assert s["phone"]["value"] == "9876543210" and s["alternatePhone"]["value"] == "9123456780"
    assert s["emergencyContactName"]["value"] == "Sunita Kumar"
    assert s["emergencyContactPhone"]["value"] == "9988776655"


def test_licence_fields_always_need_confirmation(client, headers):
    s = post(client, headers).json()["suggestions"]
    assert s["licenseType"]["routing"] == "confirm" and s["licenseNumber"]["routing"] == "confirm"
    assert s["licenseType"]["value"] == "COMMERCIAL_HEAVY"


def test_sensitive_and_system_fields_are_excluded(client, headers):
    cfg = client.get("/v1/transport-driver/fields", headers=headers).json()
    excluded = {f["key"]: f for f in cfg["fields"] if not f["ai_fillable"]}
    assert {"aadhaarNumber", "panNumber", "experienceYears", "isVerified", "status"} <= set(excluded)
    assert "personal data" in cfg["privacy"]
    keys = set(post(client, headers).json()["suggestions"])
    assert not keys & {"aadhaarNumber", "panNumber", "experienceYears", "isVerified", "verificationStatus"}


def test_aadhaar_in_text_is_redacted_before_the_provider(app, client, headers):
    r = post(client, headers, text=TEXT + "\nAadhaar: 1234 5678 9012")
    assert r.status_code == 200
    assert "1234 5678 9012" not in app.state.ai_provider.last_untrusted
    assert "[redacted-id]" in app.state.ai_provider.last_untrusted
    assert any("Aadhaar-like" in w for w in r.json()["warnings"])


def test_aadhaar_like_output_is_dropped(app, client, headers):
    ext = DriverExtraction(name=Guess(value="Ramesh Kumar", confidence=0.9),
                           licence_number=Guess(value="1234 5678 9012", confidence=0.99))
    app.state.ai_provider = Scripted(ext)
    r = post(client, headers).json()
    assert "licenseNumber" not in r["suggestions"] and "name" in r["suggestions"]
    assert any("Aadhaar-like" in w for w in r["warnings"])


def test_phone_must_be_written_in_the_text(app, client, headers):
    ext = DriverExtraction(phone=Guess(value="9000000001", confidence=0.99),
                           emergency_contact_name=Guess(value="Priya Singh", confidence=0.99))
    app.state.ai_provider = Scripted(ext)
    s = post(client, headers).json()["suggestions"]
    assert s == {}


def test_expired_licence_is_flagged(client, headers):
    r = post(client, headers, text=TEXT.replace("20/08/2028", "20/08/2025")).json()
    assert r["suggestions"]["licenseExpiryDate"]["reason"].startswith("Expired")
    assert any("expired" in w for w in r["warnings"])


def test_images_reach_the_provider_and_bad_output_is_rejected(app, client, headers):
    ext = DriverExtraction(licence_type=Guess(value="SPACESHIP", confidence=0.99),
                           licence_number=Guess(value="abc", confidence=0.99),
                           licence_expiry_date=Guess(value="soon", confidence=0.99))
    app.state.ai_provider = Scripted(ext)
    r = client.post(URL, json={"images": [fake_image("image/jpeg")]}, headers=headers)
    assert r.status_code == 200 and r.json()["suggestions"] == {}
    assert len(app.state.ai_provider.last_images) == 1


def test_module_can_be_switched_off(app, client, headers):
    app.state.settings.enable_driver_documents = False
    r = post(client, headers)
    assert r.status_code == 403 and r.json()["error"]["code"] == "forbidden"


def test_input_validation(client, headers):
    assert client.post(URL, json={}, headers=headers).status_code == 422
    assert client.post(URL, json={"images": [fake_image()] * 3}, headers=headers).status_code == 422
