import { describe, expect, it } from "vitest";
import { assetUrl, contentDiff, displayValue, routingInfo } from "./listing";

describe("routingInfo", () => {
  it("maps routing to label and tone", () => {
    expect(routingInfo("prefill").label).toMatch(/review/i);
    expect(routingInfo("confirm").tone).toBe("amber");
    expect(routingInfo("empty").tone).toBe("gray");
  });
});

describe("contentDiff", () => {
  const entry = {
    value: "Seller title",
    origin: "seller",
    version: 2,
    history: [
      { version: 1, origin: "ai", value: "AI title" },
      { version: 2, origin: "seller", value: "Seller title" },
    ],
  };
  it("returns the first AI version and the current value", () => {
    expect(contentDiff(entry)).toEqual({ ai: "AI title", current: "Seller title", changed: true });
  });
  it("reports unchanged when equal", () => {
    expect(contentDiff({ ...entry, value: "AI title" }).changed).toBe(false);
  });
  it("handles list values", () => {
    const d = contentDiff({
      value: ["a", "b"],
      origin: "seller",
      version: 2,
      history: [{ version: 1, origin: "ai", value: ["a"] }],
    });
    expect(d.changed).toBe(true);
  });
});

describe("assetUrl", () => {
  it("prefixes relative API paths and leaves absolute urls", () => {
    expect(assetUrl("/api/v1/images/1/file?x=1", "http://api")).toBe("http://api/api/v1/images/1/file?x=1");
    expect(assetUrl("https://cdn/x.png", "http://api")).toBe("https://cdn/x.png");
  });
});

describe("displayValue", () => {
  it("formats measurements, lists and booleans", () => {
    expect(displayValue({ value: 250, unit: "g" })).toBe("250 g");
    expect(displayValue(["a", "b"])).toBe("a, b");
    expect(displayValue(true)).toBe("Yes");
    expect(displayValue(null)).toBe("");
  });
});

import { normalizeQuality } from "./listing";

describe("normalizeQuality", () => {
  it("fills defaults for in-progress jobs whose quality is empty", () => {
    expect(normalizeQuality({})).toEqual({ missing_required: [], unsupported_claims: {}, warnings: [] });
    expect(normalizeQuality(undefined).warnings).toEqual([]);
  });
  it("keeps provided values", () => {
    expect(normalizeQuality({ missing_required: ["size"] }).missing_required).toEqual(["size"]);
  });
});
