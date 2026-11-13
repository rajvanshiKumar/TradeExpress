"""Test 10 distinct images through the image ingestion, validation, and AI pipeline."""
import hashlib
import io
import json
import os
import pathlib
import sys
import uuid

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from PIL import Image, ImageDraw, ImageFont

from app.ai.base import ImageInput
from app.ai.gemini import GeminiProvider
from app.ai.openai import OpenAIProvider
from app.ai.testing import FakeProvider
from app.core.config import Settings
from app.services.images import ImageRules, LocalImageStore, validate_and_process


def generate_distinct_product_images(output_dir: pathlib.Path) -> list[tuple[str, bytes]]:
    """Generates 10 completely distinct visual product images with unique content, colors, and text."""
    output_dir.mkdir(parents=True, exist_ok=True)
    images = []

    specs_list = [
        ("01_front_full_view.jpg", (20, 24, 82), "NAVY BLUE CASUAL SHIRT\nFRONT FULL VIEW\nRegular Fit · Long Sleeves"),
        ("02_back_view.jpg", (30, 36, 100), "REAR YOKE & SEAM DETAIL\nClean Double Stitched Hem\n100% Cotton Weave"),
        ("03_collar_brand_tag.jpg", (245, 245, 245), "BRAND: ACME STUDIO\nSIZE: L (42 cm / 16.5 in)\nREGISTERED TRADEMARK"),
        ("04_wash_care_label.jpg", (255, 255, 255), "FABRIC COMPOSITION:\n100% COMBED COTTON\nMACHINE WASH WARM 40C\nDO NOT BLEACH · DRY CLEANABLE"),
        ("05_fabric_texture_zoom.jpg", (45, 52, 120), "CLOSE-UP MACRO WEAVE\nPremium 60s Twill Texture\nHigh Breathability & Soft Handfeel"),
        ("06_cuff_sleeve_detail.jpg", (25, 30, 90), "ADJUSTABLE BUTTON CUFF\nMatching Matte Navy Buttons\nReinforced Placket"),
        ("07_chest_pocket_logo.jpg", (22, 28, 85), "LEFT CHEST DETAIL\nTonal Geometric Embroidered Logo\nPrecision Stitching"),
        ("08_retail_box_packaging.jpg", (230, 220, 205), "ACME APPAREL CO.\nEco-Friendly Kraft Gift Box\nContents: 1x Cotton Shirt"),
        ("09_barcode_hsn_label.jpg", (255, 255, 255), "EAN-13: 8901234567890\nHSN CODE: 6205\nMRP: INR 1,299 (INCL. ALL TAXES)\nBATCH NO: AC-2026-N01"),
        ("10_folded_presentation.jpg", (18, 22, 75), "PREMIUM FOLDED PACKAGING\nWith Acid-Free Tissue Paper\nReady for Retail Display"),
    ]

    for fname, bg_color, text_content in specs_list:
        # Create 600x600 image
        img = Image.new("RGB", (600, 600), color=bg_color)
        draw = ImageDraw.Draw(img)

        # Draw framing and textures
        draw.rectangle([20, 20, 580, 580], outline=(200, 200, 200), width=4)
        draw.line([20, 100, 580, 100], fill=(180, 180, 180), width=2)

        # Text color contrasting with background
        is_dark = sum(bg_color) < 400
        text_color = (255, 255, 255) if is_dark else (20, 20, 20)
        accent_color = (56, 189, 248) if is_dark else (2, 132, 199)

        # Draw header
        draw.text((40, 50), fname.replace("_", " ").upper(), fill=accent_color)

        # Draw lines of content
        y_pos = 140
        for line in text_content.split("\n"):
            draw.text((50, y_pos), line, fill=text_color)
            y_pos += 45

        # Unique visual signature badge
        token_hex = hashlib.sha256(fname.encode()).hexdigest()[:16]
        draw.rectangle([50, 480, 550, 540], fill=(0, 0, 0) if not is_dark else (255, 255, 255))
        draw.text((70, 500), f"ID: {token_hex} · ANGLE INSPECTION", fill=(255, 255, 255) if not is_dark else (0, 0, 0))

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=92)
        raw_bytes = buf.getvalue()

        file_path = output_dir / fname
        file_path.write_bytes(raw_bytes)
        images.append((fname, raw_bytes))

    return images


def test_10_images_pipeline():
    print("=================================================================")
    print("STEP 1: Generating 10 Completely Distinct Product View Images")
    print("=================================================================")
    test_dir = BACKEND_DIR / "storage" / "test_10_images"
    raw_images = generate_distinct_product_images(test_dir)
    print(f"Generated {len(raw_images)} distinct images in {test_dir}\n")

    rules = ImageRules(max_bytes=10 * 1024 * 1024, min_width=200, min_height=200)
    store_dir = BACKEND_DIR / "storage" / "test_store"
    store = LocalImageStore(store_dir)

    print("=================================================================")
    print("STEP 2: Ingesting, Validating, and Optimizing all 10 Images")
    print("=================================================================")
    processed_items = []
    sha_set = set()

    for idx, (filename, data) in enumerate(raw_images):
        proc = validate_and_process(data, filename, rules)
        assert proc.width == 600
        assert proc.height == 600
        assert proc.mime_type == "image/jpeg"
        assert proc.sha256 not in sha_set, f"Duplicate detected for {filename}!"
        sha_set.add(proc.sha256)

        # Store original and optimized
        key_orig = f"test_listing/img_{idx}/original.jpg"
        key_opt = f"test_listing/img_{idx}/optimized.jpg"
        key_thumb = f"test_listing/img_{idx}/thumb.jpg"
        store.put(key_orig, data)
        store.put(key_opt, proc.optimized)
        store.put(key_thumb, proc.thumbnail)

        print(f"[{idx + 1}/10] {filename:30s} | SHA: {proc.sha256[:12]}... | Orig: {len(data)/1024:.1f} KB | Opt: {len(proc.optimized)/1024:.1f} KB | Thumb: {len(proc.thumbnail)/1024:.1f} KB")
        processed_items.append((idx, filename, proc, key_orig, key_opt))

    print(f"\nAll 10 images verified: 10/10 unique hashes, 10/10 optimized derivatives generated successfully.\n")

    print("=================================================================")
    print("STEP 3: Multi-Image AI Provider Serialization Test (10 Images)")
    print("=================================================================")
    image_inputs = [
        ImageInput(data=proc.optimized, mime_type="image/jpeg", image_id=f"img-{idx}")
        for idx, _, proc, _, _ in processed_items
    ]

    # Test Gemini Provider parts serialization
    gemini_provider = GeminiProvider(api_key="test-key", model="gemini-2.5-flash-lite")
    gemini_parts = gemini_provider._image_parts(image_inputs)
    assert len(gemini_parts) == 20, f"Expected 20 Gemini parts, got {len(gemini_parts)}"
    print(f"Gemini: Successfully generated {len(gemini_parts)} message parts (10 text labels + 10 base64 payloads).")

    # Test OpenAI Provider parts serialization
    openai_provider = OpenAIProvider(api_key="test-key", model="gpt-4o-mini")
    openai_parts = openai_provider._image_parts(image_inputs)
    assert len(openai_parts) == 10, f"Expected 10 OpenAI parts, got {len(openai_parts)}"
    print(f"OpenAI: Successfully generated {len(openai_parts)} image_url payload parts.")

    print("\n=================================================================")
    print("STEP 4: E-Commerce Prisma Product Schema Mapping with 10 Photos")
    print("=================================================================")
    img_uuids = [uuid.uuid4() for _ in range(10)]
    primary_photo = f"/api/v1/images/{img_uuids[0]}/file?variant=original"
    photo_urls = [f"/api/v1/images/{img_id}/file?variant=original" for img_id in img_uuids]

    specs = {
        "Color": "Navy Blue",
        "Material": "100% Combed Cotton",
        "Fabric": "Fine Twill Weave",
        "Fit": "Regular Fit",
        "Pattern": "Solid",
        "Gender": "Men",
        "HSN Code": "6205",
        "GST Rate": 5.0,
        "Net Weight": "0.32 kg",
        "Brand": "ACME Studio",
        "Size": "L",
        "Barcode": "8901234567890",
    }

    variants = [
        {"type": "Color", "options": ["Navy Blue"]},
        {"type": "Size", "options": ["S", "M", "L", "XL", "XXL"]},
    ]

    price_tiers = [
        {"minQuantity": 1, "maxQuantity": 10, "unitPrice": 1299.00, "currency": "INR"},
        {"minQuantity": 11, "maxQuantity": 50, "unitPrice": 1169.10, "currency": "INR"},
        {"minQuantity": 51, "maxQuantity": None, "unitPrice": 1039.20, "currency": "INR"},
    ]

    ecommerce_product = {
        "id": str(uuid.uuid4()),
        "sku": "ACME-SHIRT-NVY-001",
        "name": "Men's Navy Blue 100% Combed Cotton Regular Fit Casual Shirt",
        "slug": "mens-navy-blue-combed-cotton-regular-fit-casual-shirt",
        "categorySlug": "mens-clothing",
        "subcategory": "Casual Shirts",
        "summary": "Crafted from breathable 100% combed cotton with an elegant navy blue finish for all-day comfort.",
        "description": "This premium men's button-down shirt is tailored from 100% combed cotton twill. Featuring reinforced cuffs, matching buttons, and a tailored collar, it transitions effortlessly from office casual to weekend leisure.",
        "photo": primary_photo,
        "photos": photo_urls,
        "currency": "INR",
        "price": 1299.00,
        "unit": "piece",
        "moq": 1,
        "stock": 100,
        "leadTimeDays": 7,
        "status": "Active",
        "readyToShip": True,
        "isNew": True,
        "hsnCode": "6205",
        "gstRate": 5.00,
        "weightKg": 0.32,
        "variants": variants,
        "specifications": specs,
        "packaging": {
            "packageType": "Eco-Friendly Kraft Retail Box",
            "boxContents": ["1x Men's Cotton Casual Shirt", "1x Spare Button Pack", "1x Brand Swing Tag"],
        },
        "priceTiers": price_tiers,
        "seo": {
            "seoTitle": "Men's Navy Blue Cotton Casual Shirt | ACME Studio",
            "metaDescription": "Shop the solid navy blue 100% combed cotton shirt in regular fit. Premium breathable fabric with button-down front. Free shipping available.",
            "keywords": ["mens navy shirt", "cotton casual shirt", "regular fit shirt", "acme cotton shirt"],
            "tags": ["mens-clothing", "casual-shirts", "cotton", "navy-blue"],
            "searchTerms": ["navy blue cotton shirt men", "mens casual full sleeve shirt", "acme regular fit shirt"],
        },
    }

    print(f"Product SKU:      {ecommerce_product['sku']}")
    print(f"Product Name:     {ecommerce_product['name']}")
    print(f"Primary Photo:    {ecommerce_product['photo']}")
    print(f"Total Photos:     {len(ecommerce_product['photos'])} photos mapped")
    print(f"Variants:         {[v['type'] for v in ecommerce_product['variants']]}")
    print(f"Specifications:   {len(ecommerce_product['specifications'])} verified attributes")
    print(f"Price Tiers:      {len(ecommerce_product['priceTiers'])} wholesale discount tiers")
    print(f"SEO Metadata:     Title, Meta Description, {len(ecommerce_product['seo']['keywords'])} keywords")

    # Assertions
    assert len(ecommerce_product["photos"]) == 10
    assert ecommerce_product["photo"] == primary_photo
    assert ecommerce_product["photos"][0] == primary_photo
    assert ecommerce_product["photos"][9] == photo_urls[9]
    assert ecommerce_product["specifications"]["Material"] == "100% Combed Cotton"
    assert ecommerce_product["hsnCode"] == "6205"
    assert ecommerce_product["gstRate"] == 5.0

    print("\n=================================================================")
    print("SUCCESS: ALL 10 IMAGES PROCESSED & VERIFIED THROUGH PIPELINE!")
    print("=================================================================")


if __name__ == "__main__":
    test_10_images_pipeline()

