"""Live evaluation against the real Gemini API. Opt in with TX_RUN_LIVE=1 (costs API quota).

Scores the whole pipeline on real photos (tests/fixtures/eval) and writes a JSON report.
"""
import json
import os
from pathlib import Path

import pytest

from app.ai.gemini import GeminiProvider
from app.core.config import Settings

pytestmark = [
    pytest.mark.live,
    pytest.mark.skipif(not os.environ.get("TX_RUN_LIVE"), reason="set TX_RUN_LIVE=1 to call the real API"),
]
API = "/api/v1"
FIX = Path(__file__).resolve().parent.parent / "fixtures" / "eval"
REPORT = Path(__file__).resolve().parent.parent / "reports" / "live_eval.json"
CATEGORY_ACCURACY_GATE = 0.6


async def test_live_pipeline_on_real_photos(client, app, make_account, make_org):
    cfg = Settings(_env_file=str(Path(__file__).resolve().parents[2] / ".env"))  # type: ignore[call-arg]
    assert cfg.gemini_api_key, "TX_GEMINI_API_KEY missing"
    app.state.ai_provider = GeminiProvider(
        api_key=cfg.gemini_api_key.get_secret_value(), model=cfg.gemini_model, backoff_seconds=5,
        max_retries=4, timeout=90)
    truth = json.loads((FIX / "truth.json").read_text())
    a = await make_account()
    org = await make_org(a)
    rows, correct = [], 0
    only = os.environ.get("TX_LIVE_ONLY")
    for fname, gt in truth.items():
        if only and only not in fname:
            continue
        path = FIX / fname
        mime = "image/png" if fname.endswith("png") else "image/jpeg"
        up = await client.post(f"{API}/images/upload", headers=a.h(org),
                               files={"file": (fname, path.read_bytes(), mime)})
        assert up.status_code in (200, 201), up.text
        r = await client.post(f"{API}/ai/listings/generate", headers=a.h(org),
                              json={"image_ids": [up.json()["id"]]})
        await app.state.job_runner.wait_all()
        res = (await client.get(f"{API}/ai/listings/{r.json()['job_id']}/result", headers=a.h(org))).json()
        got = (res["category"] or {}).get("slug")
        ok = got == gt["category_slug"]
        correct += ok
        rows.append({
            "image": fname, "expected": gt["category_slug"], "got": got, "correct": ok,
            "status": res["job"]["status"], "error": res["job"]["error"],
            "title": (res["content"].get("title") or {}).get("value"),
            "ocr_text": (res.get("ocr") or {}).get("full_text"),
            "attributes": {x["attribute_key"]: [x["ai_value"], x["confidence"], x["routing"], x["source"]]
                           for x in res["attributes"] if x["ai_value"] is not None},
            "unsupported_claims": res["quality"].get("unsupported_claims"),
            "missing_required": res["quality"].get("missing_required"),
            "all_attributes": {x["attribute_key"]: [x["ai_value"], x["confidence"], x["routing"], x["reason"]]
                               for x in res["attributes"]},
            "usage": res["usage"],
        })
    summary = {"model": cfg.gemini_model, "images": len(rows), "category_accuracy": correct / len(rows),
               "completed": sum(r["status"] == "awaiting_review" for r in rows),
               "total_tokens": sum(r["usage"]["input_tokens"] + r["usage"]["output_tokens"] for r in rows)}
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps({"summary": summary, "results": rows}, indent=1, ensure_ascii=False), encoding="utf-8")
    assert summary["completed"] == len(rows), summary
    if not only:
        assert summary["category_accuracy"] >= CATEGORY_ACCURACY_GATE, summary
