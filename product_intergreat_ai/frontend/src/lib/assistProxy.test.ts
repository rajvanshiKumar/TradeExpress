import { describe, expect, it } from "vitest";
import { errorBody, isSameOrigin, upstreamPath } from "./assistProxy";

describe("upstreamPath", () => {
  it("allows the documented endpoints only", () => {
    expect(upstreamPath(["rfq", "assist"], "POST")).toBe("/v1/rfq/assist");
    expect(upstreamPath(["order-address", "assist"], "POST")).toBe("/v1/order-address/assist");
    expect(upstreamPath(["transport-vehicle", "fields"], "GET")).toBe("/v1/transport-vehicle/fields");
    expect(upstreamPath(["transport-driver", "assist"], "POST")).toBe("/v1/transport-driver/assist");
    expect(upstreamPath(["health"], "GET")).toBe("/health");
  });
  it("rejects wrong methods, unknown modules and extra segments", () => {
    expect(upstreamPath(["rfq", "assist"], "GET")).toBeNull();
    expect(upstreamPath(["rfq", "fields"], "POST")).toBeNull();
    expect(upstreamPath(["admin", "assist"], "POST")).toBeNull();
    expect(upstreamPath(["rfq", "assist", "extra"], "POST")).toBeNull();
    expect(upstreamPath(["..", "etc"], "GET")).toBeNull();
    expect(upstreamPath([], "GET")).toBeNull();
    expect(upstreamPath(["docs"], "GET")).toBeNull();
  });
});

describe("isSameOrigin", () => {
  it("accepts missing Origin and a matching host", () => {
    expect(isSameOrigin(null, "localhost:3000")).toBe(true);
    expect(isSameOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });
  it("rejects other sites and garbage", () => {
    expect(isSameOrigin("https://evil.example", "localhost:3000")).toBe(false);
    expect(isSameOrigin("http://localhost:3001", "localhost:3000")).toBe(false);
    expect(isSameOrigin("not a url", "localhost:3000")).toBe(false);
  });
});

describe("errorBody", () => {
  it("uses the same envelope as the backend", () => {
    expect(JSON.parse(errorBody("x", "msg"))).toEqual({ error: { code: "x", message: "msg", details: null } });
  });
});
