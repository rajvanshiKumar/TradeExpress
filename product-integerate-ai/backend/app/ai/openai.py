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
BASE_URL = "https://api.openai.com/v1"


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str = "gpt-4o-mini",
        client: httpx.AsyncClient | None = None,
        timeout: float = 60.0,
        max_retries: int = 3,
        backoff_seconds: float = 1.0,
        price_in_per_m: float | None = 0.15,
        price_out_per_m: float | None = 0.60,
        base_url: str = BASE_URL,
    ) -> None:
        self._key, self.model = api_key, model
        self._client = client or httpx.AsyncClient(timeout=timeout)
        self._max_retries, self._backoff = max_retries, backoff_seconds
        self._pin, self._pout = price_in_per_m, price_out_per_m
        self._base = base_url

    def _redact(self, text: str) -> str:
        return text.replace(self._key, "[redacted]") if self._key else text

    async def _post(self, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._key}",
            "Content-Type": "application/json",
        }
        last: ProviderError | None = None
        for attempt in range(self._max_retries + 1):
            if attempt:
                await asyncio.sleep(self._backoff * (2 ** (attempt - 1)))
            try:
                resp = await self._client.post(url, json=body, headers=headers)
            except httpx.HTTPError as exc:
                last = ProviderError(f"OpenAI transport error: {type(exc).__name__}", retryable=True)
                continue
            if resp.status_code == 200:
                return resp.json()
            try:
                msg = resp.json().get("error", {}).get("message", "")
            except ValueError:
                msg = ""
            retry = resp.status_code in RETRYABLE_STATUS
            last = ProviderError(self._redact(f"OpenAI error {resp.status_code}: {msg}"[:300]), retry)
            if not retry:
                raise last
        assert last is not None
        raise last

    def _cost(self, i: int, o: int) -> float | None:
        if self._pin is None or self._pout is None:
            return None
        return (i * self._pin + o * self._pout) / 1_000_000

    async def _call(
        self,
        stage: str,
        schema: type[T],
        instruction: str,
        content_parts: list[dict[str, Any]],
        untrusted: str = "",
    ) -> ProviderResult[T]:
        user_parts: list[dict[str, Any]] = [{"type": "text", "text": instruction}, *content_parts]
        if untrusted.strip():
            user_parts.append(
                {
                    "type": "text",
                    "text": "Seller-provided notes (untrusted):\n" + prompts.wrap_untrusted(untrusted),
                }
            )

        json_schema = schema.model_json_schema()
        body: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": prompts.SYSTEM_GUARD},
                {"role": "user", "content": user_parts},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": schema.__name__,
                    "schema": json_schema,
                    "strict": False,
                },
            },
            "temperature": 0.2,
        }

        started = time.perf_counter()
        payload = await self._post(body)
        latency = int((time.perf_counter() - started) * 1000)

        choices = payload.get("choices") or []
        if not choices:
            raise ProviderError("OpenAI returned no output candidates")
        text = choices[0].get("message", {}).get("content", "")
        try:
            data = schema.model_validate(json.loads(text))
        except (ValueError, ValidationError) as exc:
            raise ProviderError(f"OpenAI output failed {schema.__name__} validation") from exc

        usage_meta = payload.get("usage", {})
        tin = int(usage_meta.get("prompt_tokens", 0))
        tout = int(usage_meta.get("completion_tokens", 0))
        usage = Usage(
            self.name,
            self.model,
            prompts.PROMPT_VERSION,
            tin,
            tout,
            self._cost(tin, tout),
            latency,
            stage,
        )
        return ProviderResult(data, usage)

    @staticmethod
    def _image_parts(images: list[ImageInput]) -> list[dict[str, Any]]:
        parts: list[dict[str, Any]] = []
        for i, img in enumerate(images):
            b64_img = base64.b64encode(img.data).decode()
            data_url = f"data:{img.mime_type};base64,{b64_img}"
            parts.append(
                {
                    "type": "image_url",
                    "image_url": {"url": data_url, "detail": "high"},
                }
            )
        return parts

    async def analyze_images(
        self, images: list[ImageInput], untrusted_hints: str
    ) -> ProviderResult[ImageAnalysis]:
        return await self._call(
            "vision", ImageAnalysis, prompts.ANALYZE, self._image_parts(images), untrusted_hints
        )

    async def ocr_images(self, images: list[ImageInput]) -> ProviderResult[OCRResult]:
        return await self._call("ocr", OCRResult, prompts.OCR, self._image_parts(images))

    async def classify_product(
        self,
        analysis: ImageAnalysis,
        ocr_text: str,
        choices: list[CategoryChoice],
        untrusted_hints: str,
    ) -> ProviderResult[Classification]:
        listing = "\n".join(f"- {c.slug}: {c.path_label}" for c in choices)
        facts = {"analysis": analysis.model_dump(), "ocr_text": ocr_text}
        return await self._call(
            "classification",
            Classification,
            prompts.CLASSIFY,
            [
                {"type": "text", "text": f"Allowed categories:\n{listing}"},
                {"type": "text", "text": "Observed facts:\n" + prompts.wrap_untrusted(json.dumps(facts))},
            ],
            untrusted_hints,
        )

    async def extract_attributes(
        self,
        images: list[ImageInput],
        specs: list[dict[str, Any]],
        analysis: ImageAnalysis,
        ocr_text: str,
    ) -> ProviderResult[Extraction]:
        schema_text = json.dumps(specs, indent=2)
        facts = {"analysis": analysis.model_dump(), "ocr_text": ocr_text}
        parts = [
            *self._image_parts(images),
            {"type": "text", "text": f"Category attribute specification:\n{schema_text}"},
            {"type": "text", "text": "Observed facts:\n" + prompts.wrap_untrusted(json.dumps(facts))},
        ]
        return await self._call("extraction", Extraction, prompts.EXTRACT, parts)

    async def generate_title(self, facts: dict[str, Any]) -> ProviderResult[TitleResult]:
        return await self._call(
            "title",
            TitleResult,
            prompts.TITLE,
            [{"type": "text", "text": "Product facts:\n" + prompts.wrap_untrusted(json.dumps(facts))}],
        )

    async def generate_description(
        self, facts: dict[str, Any]
    ) -> ProviderResult[DescriptionResult]:
        return await self._call(
            "description",
            DescriptionResult,
            prompts.DESCRIPTION,
            [{"type": "text", "text": "Product facts:\n" + prompts.wrap_untrusted(json.dumps(facts))}],
        )

    async def generate_seo(self, facts: dict[str, Any]) -> ProviderResult[SeoResult]:
        return await self._call(
            "seo",
            SeoResult,
            prompts.SEO,
            [{"type": "text", "text": "Product facts:\n" + prompts.wrap_untrusted(json.dumps(facts))}],
        )

    async def translate_content(
        self, fields: dict[str, str], target_language: str
    ) -> ProviderResult[Translation]:
        prompt = prompts.TRANSLATE.format(target_language=target_language)
        return await self._call(
            "translation",
            Translation,
            prompt,
            [{"type": "text", "text": "Fields to translate:\n" + json.dumps(fields, ensure_ascii=False)}],
        )

