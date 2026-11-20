import asyncio
import base64
import json
import time
from typing import Any

import httpx
from pydantic import ValidationError

from app.ai.base import AIProvider, ImageInput, ProviderError, ProviderResult, T, Usage
from app.ai.safety import wrap_untrusted

RETRYABLE = {408, 429, 500, 502, 503, 504}
BASE_URL = "https://api.openai.com/v1"


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o-mini", timeout: float = 30.0,
                 max_retries: int = 2, backoff_seconds: float = 1.0,
                 client: httpx.AsyncClient | None = None, base_url: str = BASE_URL) -> None:
        self._key, self.model = api_key, model
        self._client = client or httpx.AsyncClient(timeout=timeout)
        self._retries, self._backoff, self._base = max_retries, backoff_seconds, base_url

    def _redact(self, text: str) -> str:
        return text.replace(self._key, "[redacted]")

    async def _post(self, body: dict[str, Any]) -> dict[str, Any]:
        headers = {"Authorization": f"Bearer {self._key}", "Content-Type": "application/json"}
        last: ProviderError | None = None
        for attempt in range(self._retries + 1):
            if attempt:
                await asyncio.sleep(self._backoff * (2 ** (attempt - 1)))
            try:
                resp = await self._client.post(f"{self._base}/chat/completions", json=body, headers=headers)
            except httpx.HTTPError as exc:
                last = ProviderError(f"OpenAI transport error: {type(exc).__name__}", True)
                continue
            if resp.status_code == 200:
                return resp.json()  # type: ignore[no-any-return]
            try:
                msg = resp.json().get("error", {}).get("message", "")
            except ValueError:
                msg = ""
            retry = resp.status_code in RETRYABLE
            last = ProviderError(self._redact(f"OpenAI error {resp.status_code}: {msg}"[:300]), retry)
            if not retry:
                raise last
        assert last is not None
        raise last

    async def generate_structured(
        self, *, stage: str, schema: type[T], system: str, instruction: str, context: str,
        untrusted_text: str, prompt_version: str, images: list[ImageInput] | None = None,
    ) -> ProviderResult[T]:
        text = f"{instruction}\n\n{context}\n\nUser text (untrusted):\n" + wrap_untrusted(untrusted_text or "(none)")
        content: list[dict[str, Any]] = [{"type": "text", "text": text}]
        for img in images or []:
            b64 = base64.b64encode(img.data).decode()
            content.append({"type": "image_url", "image_url": {"url": f"data:{img.mime_type};base64,{b64}"}})
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": content}],
            "response_format": {"type": "json_schema", "json_schema": {
                "name": schema.__name__, "schema": schema.model_json_schema(), "strict": False}},
            "temperature": 0.1,
        }
        started = time.perf_counter()
        payload = await self._post(body)
        latency = int((time.perf_counter() - started) * 1000)
        choices = payload.get("choices") or []
        if not choices:
            raise ProviderError("OpenAI returned no output")
        try:
            data = schema.model_validate(json.loads(choices[0].get("message", {}).get("content", "")))
        except (ValueError, ValidationError) as exc:
            raise ProviderError(f"OpenAI output failed {schema.__name__} validation") from exc
        meta = payload.get("usage", {})
        usage = Usage(self.name, self.model, prompt_version, int(meta.get("prompt_tokens", 0)),
                      int(meta.get("completion_tokens", 0)), None, latency, stage)
        return ProviderResult(data, usage)
