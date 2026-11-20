import io
from PIL import Image

from app.services.compliance import DEFAULT_COMPLIANCE_RULES, evaluate_product_compliance
from app.services.duplicate import (
    compute_dhash,
    hamming_distance,
    text_jaccard_similarity,
)


def _make_dummy_image(color=(255, 0, 0)) -> bytes:
    img = Image.new("RGB", (100, 100), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def test_dhash_calculation_and_hamming_distance():
    img_red1 = _make_dummy_image((255, 0, 0))
    img_red2 = _make_dummy_image((250, 5, 5))
    img_blue = _make_dummy_image((0, 0, 255))

    hash_red1 = compute_dhash(img_red1)
    hash_red2 = compute_dhash(img_red2)
    hash_blue = compute_dhash(img_blue)

    assert len(hash_red1) == 16
    assert len(hash_red2) == 16
    # Identical solid colors have low or zero hamming distance
    dist_same = hamming_distance(hash_red1, hash_red2)
    assert dist_same <= 2


def test_text_similarity():
    t1 = "Apple iPhone 15 Pro Max 256GB Natural Titanium"
    t2 = "iPhone 15 Pro Max 256GB Titanium"
    t3 = "Samsung Galaxy S24 Ultra Android Smartphone"

    sim_high = text_jaccard_similarity(t1, t2)
    sim_low = text_jaccard_similarity(t1, t3)

    assert sim_high > 0.6
    assert sim_low < 0.2


def test_compliance_evaluation_eu_electronics():
    eval_res = evaluate_product_compliance(
        market_code="EU",
        category_slug="electronics",
        attributes={"voltage": "220V"},
        text_content="Clean lead-free soldering and high quality components.",
        rules=DEFAULT_COMPLIANCE_RULES,
    )
    assert eval_res.is_compliant is True
    assert len(eval_res.advisories) > 0
    assert any("CE Marking" in a["rule"] for a in eval_res.advisories)


def test_compliance_evaluation_flag_restricted_keyword():
    eval_res = evaluate_product_compliance(
        market_code="US",
        category_slug="electronics",
        attributes={"connectivity": "Bluetooth"},
        text_content="Includes high power signal jammer for privacy protection.",
        rules=DEFAULT_COMPLIANCE_RULES,
    )
    # The advisory or violation will flag "jammer"
    flagged = any("jammer" in a.get("reason", "").lower() for a in (eval_res.advisories + eval_res.violations))
    assert flagged is True


def test_compliance_evaluation_eu_clothing():
    eval_res = evaluate_product_compliance(
        market_code="EU",
        category_slug="clothing-fashion",
        attributes={"fabric": "Cotton blend"},
        text_content="Premium 100% organic cotton blend everyday casual shirt.",
        rules=DEFAULT_COMPLIANCE_RULES,
    )
    assert eval_res.is_compliant is True
    assert len(eval_res.advisories) > 0
    assert any("Textile Regulation" in a["rule"] for a in eval_res.advisories)

