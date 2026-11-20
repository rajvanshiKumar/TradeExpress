"""TEST MODE ONLY. Deterministic stand-in provider used by automated tests.

The application refuses to start with TX_AI_PROVIDER=fake unless TX_ENVIRONMENT=test, so fake
output can never be presented to sellers as real AI output.
"""
import asyncio
from typing import Any

from app.ai.base import (
    AIProvider,
    AttributeItem,
    CategoryCandidate,
    CategoryChoice,
    Classification,
    DescriptionResult,
    Extraction,
    ImageAnalysis,
    ImageInput,
    OCRItem,
    OCRResult,
    ProviderError,
    ProviderResult,
    SeoResult,
    TitleResult,
    TranslatedField,
    Translation,
    Usage,
)


class FakeProvider(AIProvider):
    name = "fake"

    def __init__(self, category_slugs: list[str] | None = None, fail_stage: str | None = None,
                 attribute_values: dict[str, tuple[Any, float, str]] | None = None) -> None:
        self.category_slugs = category_slugs or ["headphones"]
        self.fail_stage = fail_stage
        self.block = False
        self.calls: dict[str, int] = {}
        self.untrusted_seen: list[str] = []
        self._title_n = 0
        self.attribute_values = attribute_values or {
            "brand": ("ACME", 0.97, "ocr"),
            "color": ("black", 0.95, "image"),
            "connectivity": (["bluetooth"], 0.7, "image"),
            "battery_life": (40, 0.3, "image"),
            "model_number": ("X200", 0.9, "ocr"),
            "net_weight": ({"value": 250, "unit": "g"}, 0.95, "image"),
            "not_a_real_attribute": ("x", 0.99, "image"),
        }

    def _usage(self, stage: str) -> Usage:
        return Usage("fake", "fake-model", "test", 10, 5, 0.0001, 1, stage)

    async def _enter(self, method: str) -> None:
        self.calls[method] = self.calls.get(method, 0) + 1
        while self.block:
            await asyncio.sleep(0.01)
        if self.fail_stage == method:
            raise ProviderError("simulated provider failure (key=secret)".replace("secret", "[redacted]"))

    async def analyze_images(self, images: list[ImageInput], untrusted_hints: str
                             ) -> ProviderResult[ImageAnalysis]:
        await self._enter("analyze_images")
        if untrusted_hints:
            self.untrusted_seen.append(untrusted_hints)
        data = ImageAnalysis(product_type="wireless headphones", visible_colors=["black"],
                             brand="ACME", item_count=1, uncertain=["battery life"])
        return ProviderResult(data, self._usage("vision"))

    async def ocr_images(self, images: list[ImageInput]) -> ProviderResult[OCRResult]:
        await self._enter("ocr_images")
        data = OCRResult(items=[OCRItem(text="ACME", kind="brand", confidence=0.98),
                                OCRItem(text="X200", kind="model", confidence=0.9)],
                         full_text="ACME X200 Bluetooth Headphones")
        return ProviderResult(data, self._usage("ocr"))

    async def classify_product(self, analysis: ImageAnalysis, ocr_text: str,
                               choices: list[CategoryChoice], untrusted_hints: str
                               ) -> ProviderResult[Classification]:
        await self._enter("classify_product")
        cands = [CategoryCandidate(slug=s, confidence=0.9 - i * 0.1) for i, s in
                 enumerate(self.category_slugs)]
        return ProviderResult(Classification(candidates=cands), self._usage("classification"))

    async def extract_attributes(self, images: list[ImageInput], specs: list[dict[str, Any]],
                                 analysis: ImageAnalysis, ocr_text: str
                                 ) -> ProviderResult[Extraction]:
        await self._enter("extract_attributes")
        import json
        items = [AttributeItem(key=k, value_json=json.dumps(v), confidence=c, source=s,
                               evidence=f"fake evidence for {k}", image_index=0)
                 for k, (v, c, s) in self.attribute_values.items()]
        return ProviderResult(Extraction(attributes=items), self._usage("attributes"))

    async def generate_title(self, facts: dict[str, Any]) -> ProviderResult[TitleResult]:
        await self._enter("generate_title")
        self._title_n += 1
        return ProviderResult(TitleResult(title=f"ACME X200 Wireless Headphones v{self._title_n}",
                                          short_title="ACME X200 Headphones"),
                              self._usage("title"))

    async def generate_description(self, facts: dict[str, Any]
                                   ) -> ProviderResult[DescriptionResult]:
        await self._enter("generate_description")
        data = DescriptionResult(
            short_description="Black wireless headphones from ACME.",
            long_description="Black ACME X200 headphones. Enjoy 40 hours of battery life.",
            highlights=["Bluetooth connectivity", "Black finish"],
            key_features=["Wireless", "Over-ear design"],
            specifications_summary="Model X200, black.", benefits=["Cable-free listening"])
        return ProviderResult(data, self._usage("description"))

    async def generate_seo(self, facts: dict[str, Any]) -> ProviderResult[SeoResult]:
        await self._enter("generate_seo")
        data = SeoResult(seo_title="ACME X200 Wireless Headphones",
                         meta_description="Black ACME X200 Bluetooth headphones.",
                         keywords=["wireless headphones", "acme x200"], tags=["audio", "bluetooth"],
                         search_terms=["bluetooth headphones black"])
        return ProviderResult(data, self._usage("seo"))

    async def translate_content(self, fields: dict[str, str], target_language: str
                                ) -> ProviderResult[Translation]:
        await self._enter("translate_content")
        return ProviderResult(Translation(fields=[TranslatedField(field=k, value=f"[{target_language}] {v}")
                                                  for k, v in fields.items()]), self._usage("translation"))
