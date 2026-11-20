import type { NextRequest } from "next/server";
import { errorBody, isSameOrigin, MAX_BODY_BYTES, upstreamPath } from "@/lib/assistProxy";

/**
 * Server-side proxy to the Form Assistant service. The browser calls /api/assist/...; the
 * X-API-Key stays on this server (ASSIST_API_KEY) and never reaches client code.
 * Only the documented endpoints are forwarded (see lib/assistProxy.ts).
 */
export const dynamic = "force-dynamic";

const json = (status: number, body: string) =>
  new Response(body, { status, headers: { "content-type": "application/json" } });

async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return json(403, errorBody("forbidden", "Cross-site requests are not allowed"));
  }
  const { path } = await ctx.params;
  const upstream = upstreamPath(path, req.method);
  if (!upstream) return json(404, errorBody("not_found", "Unknown assistant endpoint"));

  const key = process.env.ASSIST_API_KEY;
  if (!key) {
    return json(503, errorBody("assistant_not_configured", "ASSIST_API_KEY is not set for the frontend server"));
  }
  const base = (process.env.ASSIST_URL ?? "http://localhost:8100").replace(/\/$/, "");

  let body: string | undefined;
  if (req.method === "POST") {
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) return json(413, errorBody("payload_too_large", "Request body too large"));
    body = await req.text();
    if (body.length > MAX_BODY_BYTES) return json(413, errorBody("payload_too_large", "Request body too large"));
  }

  try {
    const res = await fetch(`${base}${upstream}`, {
      method: req.method,
      headers: { "content-type": "application/json", "x-api-key": key },
      body,
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    return json(res.status, await res.text());
  } catch {
    return json(503, errorBody("assistant_unreachable", `Form Assistant is not reachable at ${base}. Is it running?`));
  }
}

export const GET = handle;
export const POST = handle;
