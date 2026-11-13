import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./api";
import { useSession } from "./store";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("ApiClient", () => {
  beforeEach(() => {
    useSession.getState().clear();
  });

  it("sends bearer token and organization header", async () => {
    useSession.getState().setTokens("acc", "ref");
    useSession.getState().setOrg("org-1");
    const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }));
    const api = new ApiClient("http://api", fetchMock);
    await api.get("/x");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api/api/v1/x");
    expect(init.headers.get("Authorization")).toBe("Bearer acc");
    expect(init.headers.get("X-Organization-Id")).toBe("org-1");
  });

  it("does not send a content-type for multipart bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    const api = new ApiClient("http://api", fetchMock);
    await api.post("/up", new FormData());
    expect(fetchMock.mock.calls[0][1].headers.has("Content-Type")).toBe(false);
  });

  it("maps the error envelope to ApiError", async () => {
    const fetchMock = vi.fn(async () =>
      json(422, { error: { code: "validation_error", message: "bad", details: { a: 1 } } }),
    );
    const api = new ApiClient("http://api", fetchMock);
    await expect(api.get("/x")).rejects.toMatchObject({ status: 422, code: "validation_error", message: "bad" });
    await expect(api.get("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("refreshes once on 401 and retries the request", async () => {
    useSession.getState().setTokens("old", "ref");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: "unauthorized", message: "expired" } }))
      .mockResolvedValueOnce(json(200, { access_token: "new", refresh_token: "ref2" }))
      .mockResolvedValueOnce(json(200, { done: true }));
    const api = new ApiClient("http://api", fetchMock);
    expect(await api.get("/x")).toEqual({ done: true });
    expect(useSession.getState().accessToken).toBe("new");
    expect(useSession.getState().refreshToken).toBe("ref2");
    expect(fetchMock.mock.calls[2][1].headers.get("Authorization")).toBe("Bearer new");
  });

  it("shares a single refresh between concurrent 401s", async () => {
    useSession.getState().setTokens("old", "ref");
    let refreshCalls = 0;
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.endsWith("/auth/refresh")) {
        refreshCalls++;
        return json(200, { access_token: "new", refresh_token: "ref2" });
      }
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer new" ? json(200, { ok: 1 }) : json(401, { error: { code: "unauthorized", message: "x" } });
    });
    const api = new ApiClient("http://api", fetchMock as unknown as typeof fetch);
    await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);
    expect(refreshCalls).toBe(1);
  });

  it("clears the session when refresh fails", async () => {
    useSession.getState().setTokens("old", "ref");
    const fetchMock = vi.fn().mockResolvedValue(json(401, { error: { code: "unauthorized", message: "no" } }));
    const api = new ApiClient("http://api", fetchMock);
    await expect(api.get("/x")).rejects.toMatchObject({ status: 401 });
    expect(useSession.getState().accessToken).toBeNull();
  });

  it("returns undefined for 204", async () => {
    const api = new ApiClient("http://api", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    expect(await api.del("/x")).toBeUndefined();
  });
});
