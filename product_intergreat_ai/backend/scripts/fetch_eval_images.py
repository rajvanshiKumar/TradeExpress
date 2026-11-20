"""Download a small real-photo evaluation set from Wikipedia article lead images (dev tool).
Ground truth is the category slug the photo should be classified into.

Usage: python scripts/fetch_eval_images.py tests/fixtures/eval
"""
import json
import pathlib
import sys

import httpx

UA = {"User-Agent": "TradeExpressListingAI-eval/0.1 (dev evaluation; contact: it1@techvunex.in)"}
CASES = [  # (wikipedia title, file stem, expected category slug)
    ("Headphones", "headphones", "headphones"),
    ("T-shirt", "tshirt", "mens-tshirts"),
    ("Potato_chip", "chips", "snacks"),
    ("Frying_pan", "frying_pan", "frying-pans"),
    ("Dumbbell", "dumbbell", "dumbbells"),
    ("Laptop", "laptop", "laptops"),
    ("Sneakers", "sneakers", "sneakers"),
    ("Backpack", "backpack", "travel-bags"),
]


def main(out: pathlib.Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    truth: dict[str, dict[str, str]] = {}
    with httpx.Client(headers=UA, follow_redirects=True, timeout=60) as c:
        for title, stem, slug in CASES:
            try:
                meta = c.get(f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}").json()
                url = (meta.get("thumbnail") or {}).get("source") or meta["originalimage"]["source"]
                url = url.replace("/thumb/", "/thumb/")
                img = c.get(url)
                img.raise_for_status()
                ctype = img.headers.get("content-type", "")
                ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(ctype.split(";")[0])
                if not ext:
                    print("skip (type)", title, ctype)
                    continue
                (out / f"{stem}.{ext}").write_bytes(img.content)
                truth[f"{stem}.{ext}"] = {"category_slug": slug, "source": f"wikipedia:{title}"}
                print("ok", stem, len(img.content))
            except Exception as exc:  # noqa: BLE001
                print("fail", title, type(exc).__name__, exc)
    (out / "truth.json").write_text(json.dumps(truth, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main(pathlib.Path(sys.argv[1]))
