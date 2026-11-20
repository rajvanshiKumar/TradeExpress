import { afterEach, describe, expect, it, vi } from "vitest";
import { applySuggestions, AssistError, buildBody, callAssist, claimField, flattenCategories, currentValues, MODULES, moduleById, undoField, userTypedValues, type FieldSuggestion } from "./assist";

const rfq = moduleById("rfq");
const vehicle = moduleById("vehicle");

describe("module configs", () => {
  it("covers the four modules with unique ids and proxy paths", () => {
    expect(MODULES.map((m) => m.id)).toEqual(["rfq", "address", "vehicle", "driver"]);
    expect(new Set(MODULES.map((m) => m.path)).size).toBe(4);
  });
  it("marks money, verification and government-id fields as never AI-filled", () => {
    const never = (id: Parameters<typeof moduleById>[0]) =>
      moduleById(id).fields.filter((f) => f.kind === "never").map((f) => f.key);
    expect(never("rfq")).toContain("targetPrice");
    expect(never("address")).toContain("total");
    expect(never("vehicle")).toContain("isVerified");
    expect(never("driver")).toEqual(expect.arrayContaining(["aadhaarNumber", "isVerified"]));
  });
  it("only documents modules accept images", () => {
    expect(MODULES.filter((m) => m.maxImages > 0).map((m) => m.id)).toEqual(["vehicle", "driver"]);
  });
});

describe("currentValues", () => {
  it("keeps typed values, drops blanks and never-fillable fields", () => {
    expect(currentValues(rfq, { title: " Bolts ", quantity: "  ", targetPrice: "100" })).toEqual({ title: "Bolts" });
  });
});

describe("buildBody", () => {
  const base = { text: "500 bolts", extras: { categories: '[{"slug":"fasteners","name":"F"}]' }, values: {}, skipFilled: true };
  it("builds the RFQ body with parsed categories", () => {
    const b = buildBody(rfq, { ...base, today: " 2026-11-13 " });
    expect(b).toMatchObject({ text: "500 bolts", skip_filled: true, today: "2026-11-13", categories: [{ slug: "fasteners", name: "F" }] });
    expect(b).not.toHaveProperty("images");
  });
  it("rejects bad category JSON with a readable error", () => {
    expect(() => buildBody(rfq, { ...base, extras: { categories: "{nope" } })).toThrow("not valid JSON");
    expect(() => buildBody(rfq, { ...base, extras: { categories: "{}" } })).toThrow("JSON array");
  });
  it("sends images and company_name for the vehicle module", () => {
    const img = { mime_type: "image/png", data_base64: "AAAA" };
    const b = buildBody(vehicle, { text: "", extras: { company: " Sharma Transport " }, values: {}, skipFilled: false, images: [img] });
    expect(b).toMatchObject({ images: [img], company_name: "Sharma Transport", skip_filled: false });
    expect(buildBody(vehicle, { text: "x", extras: {}, values: {}, skipFilled: true }).company_name).toBeNull();
  });
});

describe("callAssist", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts JSON to the proxy and returns the parsed response", async () => {
    const payload = { suggestions: { quantity: { value: 500, confidence: 0.9, routing: "prefill", reason: "" } }, skipped: {}, warnings: [], usage: {} };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await callAssist(rfq, { text: "x" });
    expect(out.suggestions.quantity.value).toBe(500);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/assist/rfq/assist");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
  it("turns the backend error envelope into an AssistError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "rate_limited", message: "slow down" } }), { status: 429 })));
    await expect(callAssist(rfq, {})).rejects.toMatchObject({ status: 429, code: "rate_limited", message: "slow down" });
  });
  it("never fakes data when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("failed")));
    await expect(callAssist(rfq, {})).rejects.toBeInstanceOf(AssistError);
  });
  it("handles non-JSON responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>oops</html>", { status: 502 })));
    await expect(callAssist(rfq, {})).rejects.toMatchObject({ code: "bad_response" });
  });
});

const sug = (value: string | number, routing: "prefill" | "confirm" = "prefill"): FieldSuggestion => ({ value, confidence: 0.9, routing, reason: "" });

describe("auto-fill helpers", () => {
  it("fills every suggestion and remembers the previous value", () => {
    const r = applySuggestions({ title: "typed" }, {}, { title: sug("AI title"), quantity: sug(500) });
    expect(r.values).toEqual({ title: "AI title", quantity: "500" });
    expect(r.aiFilled).toEqual({ title: { prev: "typed" }, quantity: { prev: "" } });
  });

  it("AI-filled values do not count as user-filled (the reported bug)", () => {
    const first = applySuggestions({}, {}, { title: sug("old bolts title"), quantity: sug(500) });
    expect(userTypedValues(first.values, first.aiFilled)).toEqual({});
    expect(currentValues(rfq, userTypedValues(first.values, first.aiFilled))).toEqual({});
  });

  it("a new request replaces the old AI output completely, even fields it no longer suggests", () => {
    const first = applySuggestions({ title: "mine" }, {}, { title: sug("old"), quantity: sug(500), unit: sug("piece") });
    const second = applySuggestions(first.values, first.aiFilled, { title: sug("new wire title") });
    expect(second.values).toEqual({ title: "new wire title", quantity: "", unit: "" });
    expect(second.aiFilled).toEqual({ title: { prev: "mine" } });
  });

  it("user-typed fields stay and are never part of the rollback", () => {
    const first = applySuggestions({}, {}, { title: sug("ai") });
    const typed = { ...first.values, quantity: "7" }; // user typed quantity
    const second = applySuggestions(typed, first.aiFilled, { title: sug("ai2") });
    expect(second.values).toEqual({ title: "ai2", quantity: "7" });
  });

  it("undo restores the previous value; claiming a field removes AI ownership", () => {
    const r = applySuggestions({ title: "mine" }, {}, { title: sug("ai") });
    expect(undoField(r.values, r.aiFilled, "title")).toEqual({ values: { title: "mine" }, aiFilled: {} });
    expect(undoField(r.values, r.aiFilled, "nope")).toEqual(r);
    expect(claimField(r.aiFilled, "title")).toEqual({});
    expect(claimField(r.aiFilled, "other")).toBe(r.aiFilled);
  });
});

describe("flattenCategories", () => {
  type Node = import("./types").CategoryNode;
  const node = (slug: string, name: string, children: Node[] = []): Node => ({ id: slug, slug, name, level: 0, children });

  it("flattens the tree into slug + readable path, parents first", () => {
    const tree = [node("electronics", "Electronics", [node("audio", "Audio", [node("headphones", "Headphones")])]), node("textiles", "Textiles")];
    expect(flattenCategories(tree)).toEqual([
      { slug: "electronics", name: "Electronics" },
      { slug: "audio", name: "Electronics > Audio" },
      { slug: "headphones", name: "Electronics > Audio > Headphones" },
      { slug: "textiles", name: "Textiles" },
    ]);
  });
  it("skips duplicate slugs, tolerates bad input and respects the cap", () => {
    expect(flattenCategories([node("a", "A"), node("a", "A again")])).toHaveLength(1);
    expect(flattenCategories(undefined)).toEqual([]);
    expect(flattenCategories({} as never)).toEqual([]);
    expect(flattenCategories([node("a", "A"), node("b", "B"), node("c", "C")], 2)).toHaveLength(2);
  });
});
