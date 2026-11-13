import asyncio
import base64
import json
import time
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.ai import prompts
from app.ai.base import (
    AIProvider,
    CategoryChoice,
    Classification,
    DescriptionResult,
    Extraction,
    FullContentResult,
    ImageAnalysis,
    ImageInput,
    OCRResult,
    ProviderError,
    ProviderResult,
    SeoResult,
    TitleResult,
    Translation,
    Usage,
)

T = TypeVar("T", bound=BaseModel)
RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}
BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(
        self, api_key: str, model: str, client: httpx.AsyncClient | None = None,
        timeout: float = 60.0, max_retries: int = 3, backoff_seconds: float = 1.0,
        price_in_per_m: float | None = None, price_out_per_m: float | None = None,
        base_url: str = BASE_URL,
    ) -> None:
        self._key, self.model = api_key, model
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=40, keepalive_expiry=120)
        self._client = client or httpx.AsyncClient(timeout=timeout, limits=limits)
        self._max_retries, self._backoff = max_retries, backoff_seconds
        self._pin, self._pout = price_in_per_m, price_out_per_m
        self._base = base_url

    def _redact(self, text: str) -> str:
        return text.replace(self._key, "[redacted]")

    async def _post(self, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base}/models/{self.model}:generateContent"
        last: ProviderError | None = None
        for attempt in range(self._max_retries + 1):
            if attempt:
                await asyncio.sleep(self._backoff * (2 ** (attempt - 1)))
            try:
                resp = await self._client.post(url, json=body, headers={"x-goog-api-key": self._key})
            except httpx.HTTPError as exc:
                last = ProviderError(f"Gemini transport error: {type(exc).__name__}", True)
                continue
            if resp.status_code == 200:
                payload: dict[str, Any] = resp.json()
                return payload
            try:
                msg = resp.json().get("error", {}).get("message", "")
            except ValueError:
                msg = ""
            retry = resp.status_code in RETRYABLE_STATUS
            last = ProviderError(self._redact(f"Gemini error {resp.status_code}: {msg}"[:300]), retry)
            if not retry:
                raise last
        assert last is not None
        raise last

    def _cost(self, i: int, o: int) -> float | None:
        if self._pin is None or self._pout is None:
            return None
        return (i * self._pin + o * self._pout) / 1_000_000

    async def _call(
        self, stage: str, schema: type[T], instruction: str, parts: list[dict[str, Any]],
        untrusted: str = "",
    ) -> ProviderResult[T]:
        user_parts: list[dict[str, Any]] = [{"text": instruction}, *parts]
        if untrusted.strip():
            user_parts.append({"text": "Seller-provided notes (untrusted):\n"
                               + prompts.wrap_untrusted(untrusted)})
        body = {
            "systemInstruction": {"parts": [{"text": prompts.SYSTEM_GUARD}]},
            "contents": [{"role": "user", "parts": user_parts}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema.model_json_schema(),
                "temperature": 0.2,
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
        tin, tout = int(meta.get("promptTokenCount", 0)), int(meta.get("candidatesTokenCount", 0))
        usage = Usage(self.name, self.model, prompts.PROMPT_VERSION, tin, tout,
                      self._cost(tin, tout), latency, stage)
        return ProviderResult(data, usage)

    @staticmethod
    def _image_parts(images: list[ImageInput]) -> list[dict[str, Any]]:
        parts: list[dict[str, Any]] = []
        for i, img in enumerate(images):
            parts.append({"text": f"Image {i}:"})
            parts.append({"inline_data": {"mime_type": img.mime_type,
                                          "data": base64.b64encode(img.data).decode()}})
        return parts

    async def analyze_images(self, images: list[ImageInput], untrusted_hints: str
                             ) -> ProviderResult[ImageAnalysis]:
        return await self._call("vision", ImageAnalysis, prompts.ANALYZE,
                                self._image_parts(images), untrusted_hints)

    async def ocr_images(self, images: list[ImageInput]) -> ProviderResult[OCRResult]:
        return await self._call("ocr", OCRResult, prompts.OCR, self._image_parts(images))

    async def classify_product(self, analysis: ImageAnalysis, ocr_text: str,
                               choices: list[CategoryChoice], untrusted_hints: str
                               ) -> ProviderResult[Classification]:
        listing = "\n".join(f"- {c.slug}: {c.path_label}" for c in choices)
        facts = {"analysis": analysis.model_dump(), "ocr_text": ocr_text}
        return await self._call(
            "classification", Classification, prompts.CLASSIFY,
            [{"text": f"Allowed categories:\n{listing}"},
             {"text": "Observed facts:\n" + prompts.wrap_untrusted(json.dumps(facts))}],
            untrusted_hints)

    async def extract_attributes(self, images: list[ImageInput], specs: list[dict[str, Any]],
                                 analysis: ImageAnalysis, ocr_text: str
                                 ) -> ProviderResult[Extraction]:
        facts = {"analysis": analysis.model_dump(), "ocr_text": ocr_text}
        parts = [*self._image_parts(images),
                 {"text": "Requested attributes:\n" + json.dumps(specs)},
                 {"text": "Observed facts:\n" + prompts.wrap_untrusted(json.dumps(facts))}]
        return await self._call("attributes", Extraction, prompts.EXTRACT, parts)

    def _facts_part(self, facts: dict[str, Any]) -> list[dict[str, Any]]:
        return [{"text": "Facts:\n" + prompts.wrap_untrusted(json.dumps(facts, default=str))}]

    async def generate_all_content(self, facts: dict[str, Any]) -> ProviderResult[FullContentResult]:
        return await self._call("content", FullContentResult, prompts.FULL_CONTENT, self._facts_part(facts))

    async def generate_title(self, facts: dict[str, Any]) -> ProviderResult[TitleResult]:
        return await self._call("title", TitleResult, prompts.TITLE, self._facts_part(facts))

    async def generate_description(self, facts: dict[str, Any]
                                   ) -> ProviderResult[DescriptionResult]:
        return await self._call("description", DescriptionResult, prompts.DESCRIPTION,
                                self._facts_part(facts))

    async def generate_seo(self, facts: dict[str, Any]) -> ProviderResult[SeoResult]:
        return await self._call("seo", SeoResult, prompts.SEO, self._facts_part(facts))

    async def translate_content(self, fields: dict[str, str], target_language: str
                                ) -> ProviderResult[Translation]:
        parts = [{"text": f"Target language: {target_language}"},
                 {"text": "Fields:\n" + prompts.wrap_untrusted(json.dumps(fields))}]
        return await self._call("translation", Translation, prompts.TRANSLATE, parts)
