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
BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, api_key: str, model: str, timeout: float = 30.0, max_retries: int = 2,
                 backoff_seconds: float = 1.0, client: httpx.AsyncClient | None = None,
                 base_url: str = BASE_URL) -> None:
        self._key, self.model = api_key, model
        self._client = client or httpx.AsyncClient(timeout=timeout)
        self._retries, self._backoff, self._base = max_retries, backoff_seconds, base_url

    def _redact(self, text: str) -> str:
        return text.replace(self._key, "[redacted]")

    async def _post(self, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base}/models/{self.model}:generateContent"
        last: ProviderError | None = None
        for attempt in range(self._retries + 1):
            if attempt:
                await asyncio.sleep(self._backoff * (2 ** (attempt - 1)))
            try:
                resp = await self._client.post(url, json=body, headers={"x-goog-api-key": self._key})
            except httpx.HTTPError as exc:
                last = ProviderError(f"Gemini transport error: {type(exc).__name__}", True)
                continue
            if resp.status_code == 200:
                return resp.json()  # type: ignore[no-any-return]
            try:
                msg = resp.json().get("error", {}).get("message", "")
            except ValueError:
                msg = ""
            retry = resp.status_code in RETRYABLE
            last = ProviderError(self._redact(f"Gemini error {resp.status_code}: {msg}"[:300]), retry)
            if not retry:
                raise last
        assert last is not None
        raise last

    async def generate_structured(
        self, *, stage: str, schema: type[T], system: str, instruction: str, context: str,
        untrusted_text: str, prompt_version: str, images: list[ImageInput] | None = None,
    ) -> ProviderResult[T]:
        parts: list[dict[str, Any]] = [{"text": instruction}, {"text": context}]
        for i, img in enumerate(images or []):
            parts.append({"text": f"Document image {i + 1} (untrusted data):"})
            parts.append({"inline_data": {"mime_type": img.mime_type,
                                          "data": base64.b64encode(img.data).decode()}})
        parts.append({"text": "User text (untrusted):\n" + wrap_untrusted(untrusted_text or "(none)")})
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema.model_json_schema(),
                "temperature": 0.1,
            },
        }
        started = time.perf_counter()
        payload = await self._post(body)
        latency = int((time.perf_counter() - started) * 1000)
        candidates = payload.get("candidates") or []
        if not candidates:
            reason = payload.get("promptFeedback", {}).get("blockReason", "no candidates")
            raise ProviderError(f"Gemini returned no output ({reason})")
        text = "".join(p.get("text", "") for p in candidates[0].get("content", {}).get("parts", []))
        try:
            data = schema.model_validate(json.loads(text))
        except (ValueError, ValidationError) as exc:
            raise ProviderError(f"Gemini output failed {schema.__name__} validation") from exc
        meta = payload.get("usageMetadata", {})
        usage = Usage(self.name, self.model, prompt_version, int(meta.get("promptTokenCount", 0)),
                      int(meta.get("candidatesTokenCount", 0)), None, latency, stage)
        return ProviderResult(data, usage)
