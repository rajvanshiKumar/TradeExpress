from app.services.translation import LANGUAGES, flatten_fields, unflatten_fields


def test_flatten_and_unflatten_roundtrip_with_lists():
    content = {"title": "T", "highlights": ["a", "b"], "tags": []}
    flat = flatten_fields(content)
    assert flat == {"title": "T", "highlights.0": "a", "highlights.1": "b"}
    assert unflatten_fields(flat) == {"title": "T", "highlights": ["a", "b"]}


def test_unflatten_keeps_list_order_beyond_ten():
    flat = {f"tags.{i}": str(i) for i in range(12)}
    assert unflatten_fields(flat)["tags"] == [str(i) for i in range(12)]


def test_unflatten_ignores_fields_not_requested():
    out = unflatten_fields({"title": "x", "evil": "y"}, allowed={"title"})
    assert out == {"title": "x"}


def test_languages_cover_spec_and_flag_rtl():
    assert {"en", "hi", "fr", "de", "es", "ar", "pt", "it", "ja", "zh"} <= set(LANGUAGES)
    assert LANGUAGES["ar"]["rtl"] is True and LANGUAGES["en"]["rtl"] is False


def test_translatable_fields_excludes_technical_codes():
    from app.services.translation import TRANSLATABLE_FIELDS

    # Text fields that must be translated
    assert "title" in TRANSLATABLE_FIELDS
    assert "long_description" in TRANSLATABLE_FIELDS
    assert "highlights" in TRANSLATABLE_FIELDS
    assert "seo_title" in TRANSLATABLE_FIELDS

    # Technical and pricing fields that MUST NOT be sent for translation
    assert "sku" not in TRANSLATABLE_FIELDS
    assert "slug" not in TRANSLATABLE_FIELDS
    assert "hsn_code" not in TRANSLATABLE_FIELDS
    assert "gst_rate" not in TRANSLATABLE_FIELDS
    assert "weight_kg" not in TRANSLATABLE_FIELDS
    assert "suggested_price_inr" not in TRANSLATABLE_FIELDS
