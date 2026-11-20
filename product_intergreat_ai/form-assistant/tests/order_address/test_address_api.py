from app.core.schemas import Guess
from app.modules.order_address.schemas import AddressExtraction
from tests.conftest import Scripted

URL = "/v1/order-address/assist"
TEXT = (
    "Name: Rahul Sharma\n"
    "Company: Sharma Traders Pvt Ltd\n"
    "Phone: +91 98765 43210\n"
    "Email: rahul@sharmatraders.in\n"
    "GSTIN: 27AAPFU0939F1ZV\n"
    "Address: Flat 4B, Shiv Residency, Baner Road, Pune, Maharashtra 411045"
)


def post(client, headers, text=TEXT, **extra):
    return client.post(URL, json={"text": text, **extra}, headers=headers)


def test_requires_api_key(client):
    assert client.post(URL, json={"text": TEXT}).status_code == 401


def test_happy_path(client, headers):
    r = post(client, headers)
    assert r.status_code == 200, r.text
    s = r.json()["suggestions"]
    assert s["buyerName"]["value"] == "Rahul Sharma"
    assert s["buyerPhone"]["value"] == "9876543210"
    assert s["buyerEmail"]["value"] == "rahul@sharmatraders.in"
    assert s["buyerGstin"]["value"] == "27AAPFU0939F1ZV"
    assert s["buyerCompany"]["value"] == "Sharma Traders Pvt Ltd"
    assert s["deliveryAddress.pincode"]["value"] == "411045"
    assert s["deliveryAddress.state"]["value"] == "Maharashtra"
    assert s["deliveryAddress.city"]["value"] == "Pune"
    assert s["deliveryAddress.line1"]["value"] == "Flat 4B"
    assert not r.json()["warnings"]  # GSTIN state 27 == Maharashtra


def test_gstin_state_mismatch_warns(client, headers):
    r = post(client, headers, text=TEXT.replace("Maharashtra", "Gujarat"))
    assert any("GSTIN belongs to Maharashtra" in w for w in r.json()["warnings"])


def test_amounts_and_status_are_not_ai_fields(client, headers):
    cfg = client.get("/v1/order-address/fields", headers=headers).json()
    excluded = {f["key"] for f in cfg["fields"] if not f["ai_fillable"]}
    assert {"supplierGstin", "subtotal", "orderStatus"} <= excluded


def test_aadhaar_never_reaches_the_provider(app, client, headers):
    r = post(client, headers, text=TEXT + "\nAadhaar 1234 5678 9012")
    assert r.status_code == 200
    assert "1234 5678 9012" not in app.state.ai_provider.last_untrusted
    assert any("Aadhaar-like" in w for w in r.json()["warnings"])


def test_bad_model_output_is_rejected(app, client, headers):
    ext = AddressExtraction(
        buyer_gstin=Guess(value="27AAPFU0939F1ZX", confidence=0.99),      # bad checksum
        buyer_phone=Guess(value="9123456789", confidence=0.99),            # valid, but not in the text
        buyer_email=Guess(value="evil@example.com", confidence=0.99),      # not in the text
        state=Guess(value="Narnia", confidence=0.99),
        pincode=Guess(value="560001", confidence=0.99),                    # not in the text
        city=Guess(value="Pune", confidence=0.3),                          # low confidence
    )
    app.state.ai_provider = Scripted(ext)
    body = post(client, headers).json()
    for f in ("buyerGstin", "buyerPhone", "buyerEmail", "deliveryAddress.state", "deliveryAddress.pincode",
              "deliveryAddress.city"):
        assert f not in body["suggestions"], f


def test_skip_filled(client, headers):
    r = post(client, headers, current_values={"buyerName": "Typed By User"})
    assert "buyerName" not in r.json()["suggestions"]
    assert r.json()["skipped"]["buyerName"] == "already filled by the user"


def test_validation_and_provider_errors(app, client, headers):
    assert client.post(URL, json={"text": "x"}, headers=headers).status_code == 422
    app.state.ai_provider.fail = True
    assert post(client, headers).status_code == 502
