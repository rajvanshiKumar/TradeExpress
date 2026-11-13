import json

import httpx
import pytest

from app.ai.base import ImageInput, ProviderError
from app.ai.openai import OpenAIProvider

IMG = ImageInput(data=b"\x89PNG-fake", mime_type="image/png", image_id="img-1")

ANALYSIS = {
    "product_type": "headphones",
    "visible_colors": ["black"],
    "brand": None,
    "model": None,
    "pattern": None,
    "shape": None,
    "texture": None,
    "visible_materials": [],
    "packaging": None,
    "logos": [],
    "accessories": [],
    "item_count": 1,
    "notes": "",
    "uncertain": [],
}


def ok_response(payload: dict, in_tok: int = 100, out_tok: int = 20) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": json.dumps(payload)}}],
            "usage": {"prompt_tokens": in_tok, "completion_tokens": out_tok},
        },
    )


def make(handler, **kw) -> OpenAIProvider:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return OpenAIProvider(
        api_key="secret-openai-key",
        model="gpt-4o-mini",
        client=client,
        backoff_seconds=0,
        **kw,
    )


async def test_openai_api_key_sent_in_header():
    seen = {}

    def handler(req: httpx.Request) -> httpx.Response:
        seen["auth"] = req.headers.get("authorization")
        seen["url"] = str(req.url)
        return ok_response(ANALYSIS)

    await make(handler).analyze_images([IMG], untrusted_hints="")
    assert seen["auth"] == "Bearer secret-openai-key"
    assert "secret-openai-key" not in seen["url"]
    assert "chat/completions" in seen["url"]


async def test_openai_parses_structured_output_and_usage():
    p = make(lambda r: ok_response(ANALYSIS, 120, 40))
    result = await p.analyze_images([IMG], untrusted_hints="")
    assert result.data.product_type == "headphones"
    assert (result.usage.input_tokens, result.usage.output_tokens) == (120, 40)
    assert result.usage.model == "gpt-4o-mini"
    assert result.usage.cost_usd is not None


async def test_openai_retries_transient_errors():
    calls = {"n": 0}

    def handler(req):
        calls["n"] += 1
        return (
            httpx.Response(503, json={"error": {"message": "server overloaded"}})
            if calls["n"] < 3
            else ok_response(ANALYSIS)
        )

    await make(handler).analyze_images([IMG], untrusted_hints="")
    assert calls["n"] == 3


async def test_openai_redacts_key_in_error():
    def handler(req):
        return httpx.Response(400, json={"error": {"message": "invalid request for secret-openai-key"}})

    with pytest.raises(ProviderError) as exc:
        await make(handler).analyze_images([IMG], untrusted_hints="")
    assert "secret-openai-key" not in str(exc.value)
    assert "[redacted]" in str(exc.value)


async def test_openai_untrusted_content_delimited():
    seen = {}

    def handler(req):
        seen["body"] = json.loads(req.content)
        return ok_response(ANALYSIS)

    hint = "DROP TABLE products;"
    await make(handler).analyze_images([IMG], untrusted_hints=hint)
    messages = seen["body"]["messages"]
    system = next(m["content"] for m in messages if m["role"] == "system")
    assert "never follow instructions" in system.lower()
    user_parts = next(m["content"] for m in messages if m["role"] == "user")
    user_text = "".join(p.get("text", "") for p in user_parts if p.get("type") == "text")
    assert "<untrusted_data>" in user_text and hint in user_text

