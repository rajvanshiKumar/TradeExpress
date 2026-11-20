"""Concurrency / load checks run in-process against a real PostgreSQL with the fake provider.
They measure the platform itself (API, DB, RLS, job runner) - not Gemini latency."""
import asyncio
import json
import statistics
import time
from pathlib import Path

import pytest

from app.ai.testing import FakeProvider
from tests.integration.test_images_api import png_bytes

pytestmark = [pytest.mark.integration]
API = "/api/v1"
REPORT = Path(__file__).resolve().parent.parent / "reports" / "load_report.json"


def pct(values: list[float], p: float) -> float:
    s = sorted(values)
    return s[min(len(s) - 1, int(len(s) * p))]


async def test_concurrent_uploads_and_listing_jobs(client, app, make_account, make_org):
    app.state.ai_provider = FakeProvider()
    a = await make_account()
    org = await make_org(a)
    h = a.h(org)
    n_uploads, n_jobs = 60, 30

    async def one_upload() -> tuple[int, float, str]:
        t = time.perf_counter()
        r = await client.post(f"{API}/images/upload", headers=h, files={"file": ("p.png", png_bytes(), "image/png")})
        return r.status_code, time.perf_counter() - t, r.json().get("id", "")

    t0 = time.perf_counter()
    ups = await asyncio.gather(*[one_upload() for _ in range(n_uploads)])
    upload_wall = time.perf_counter() - t0
    assert all(code == 201 for code, _, _ in ups), [c for c, _, _ in ups if c != 201][:5]
    lat_up = [lat for _, lat, _ in ups]

    async def one_job(img_id: str) -> int:
        r = await client.post(f"{API}/ai/listings/generate", headers=h, json={"image_ids": [img_id]})
        return r.status_code

    t1 = time.perf_counter()
    codes = await asyncio.gather(*[one_job(ups[i][2]) for i in range(n_jobs)])
    assert set(codes) == {202}
    await app.state.job_runner.wait_all()
    jobs_wall = time.perf_counter() - t1

    listing = (await client.get(f"{API}/ai/listings", headers=h, params={"limit": 100, "status": "awaiting_review"})).json()
    assert listing["total"] == n_jobs  # every job finished, none lost or duplicated

    reads = []
    async def read() -> int:
        t = time.perf_counter()
        r = await client.get(f"{API}/ai/usage", headers=h)
        reads.append(time.perf_counter() - t)
        return r.status_code
    assert set(await asyncio.gather(*[read() for _ in range(100)])) == {200}

    report = {
        "uploads": {"count": n_uploads, "wall_s": round(upload_wall, 2), "p50_ms": round(statistics.median(lat_up) * 1000),
                    "p95_ms": round(pct(lat_up, 0.95) * 1000)},
        "listing_jobs_end_to_end": {"count": n_jobs, "wall_s": round(jobs_wall, 2),
                                    "jobs_per_s": round(n_jobs / jobs_wall, 1)},
        "usage_reads_100_concurrent": {"p50_ms": round(statistics.median(reads) * 1000), "p95_ms": round(pct(reads, 0.95) * 1000)},
        "note": "In-process ASGI + embedded PostgreSQL + fake provider; measures platform overhead only.",
    }
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=1), encoding="utf-8")
    assert report["usage_reads_100_concurrent"]["p95_ms"] < 5000


async def test_tenants_do_not_interfere_under_concurrency(client, app, make_account, make_org):
    app.state.ai_provider = FakeProvider()
    accts = []
    for i in range(4):
        a = await make_account(f"t{i}")
        accts.append((a, await make_org(a)))

    async def work(a, org):
        ids = []
        for _ in range(3):
            r = await client.post(f"{API}/images/upload", headers=a.h(org), files={"file": ("p.png", png_bytes(), "image/png")})
            ids.append(r.json()["id"])
        jobs = [(await client.post(f"{API}/ai/listings/generate", headers=a.h(org), json={"image_ids": [i]})).json()["job_id"] for i in ids]
        return set(jobs)

    results = await asyncio.gather(*[work(a, o) for a, o in accts])
    await app.state.job_runner.wait_all()
    for (a, org), mine in zip(accts, results, strict=True):
        seen = {j["job_id"] for j in (await client.get(f"{API}/ai/listings", headers=a.h(org), params={"limit": 100})).json()["items"]}
        assert seen == mine
