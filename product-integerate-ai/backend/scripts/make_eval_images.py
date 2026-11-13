"""Generate a small evaluation image set with Gemini image generation (dev tool, needs API key).
Ground truth is what we asked the generator to draw; it is used to score the listing pipeline.

Usage: python scripts/make_eval_images.py tests/fixtures/eval
"""
import base64
import json
import pathlib
import sys

import httpx

CASES = [
    ("headphones", "headphones", "Studio product photo of black over-ear wireless headphones on a white "
     "background, with the text 'SONIQ X200' and 'Bluetooth 5.3' printed clearly on the ear cup.",
     {"brand": "SONIQ", "model_number": "X200", "color": "black"}),
    ("mens-tshirts", "tshirt", "Product photo of a plain white men's crew-neck cotton t-shirt laid flat, "
     "with a clearly legible neck label reading 'URBANFIT Size M'.",
     {"brand": "URBANFIT", "color": "white", "size": "M"}),
    ("snacks", "chips", "Product photo of a red foil bag of salted potato chips, front label reads "
     "'CRUNCHYBITES Salted Chips' and 'Net Wt 150 g', white background.",
     {"brand": "CRUNCHYBITES", "color": "red"}),
    ("frying-pans", "pan", "Product photo of a black non-stick frying pan with a sticker reading "
     "'CHEFMATE 28 cm' on the base, white background.",
     {"brand": "CHEFMATE", "color": "black"}),
    ("dumbbells", "dumbbell", "Product photo of a black hex rubber dumbbell with '10 kg' and the brand "
     "'IRONCORE' engraved in white on the end, white background.",
     {"brand": "IRONCORE", "color": "black"}),
    ("face-creams", "cream", "Product photo of a white cosmetic face cream jar with a label reading "
     "'GLOWLAB Hydrating Face Cream 50 ml', white background.",
     {"brand": "GLOWLAB"}),
]


def main(out: pathlib.Path) -> None:
    key = next(line.split("=", 1)[1].strip() for line in open(".env") if line.startswith("TX_GEMINI_API_KEY"))
    out.mkdir(parents=True, exist_ok=True)
    truth = {}
    for slug, name, prompt, attrs in CASES:
        r = httpx.post(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent",
            headers={"x-goog-api-key": key}, timeout=180,
            json={"contents": [{"parts": [{"text": prompt}]}],
                  "generationConfig": {"responseModalities": ["IMAGE"]}})
        r.raise_for_status()
        parts = r.json()["candidates"][0]["content"]["parts"]
        img = next(p for p in parts if "inlineData" in p or "inline_data" in p)
        blob = img.get("inlineData") or img.get("inline_data")
        ext = "png" if "png" in blob.get("mimeType", blob.get("mime_type", "png")) else "jpg"
        (out / f"{name}.{ext}").write_bytes(base64.b64decode(blob["data"]))
        truth[f"{name}.{ext}"] = {"category_slug": slug, "attributes": attrs}
        print("ok", name, flush=True)
    (out / "truth.json").write_text(json.dumps(truth, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
