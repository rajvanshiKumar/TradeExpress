import type { ContentEntry, Routing } from "./types";

export type Tone = "green" | "amber" | "gray";

export function routingInfo(routing: Routing): { label: string; tone: Tone } {
  switch (routing) {
    case "prefill":
      return { label: "Pre-filled · review", tone: "green" };
    case "confirm":
      return { label: "Please confirm", tone: "amber" };
    default:
      return { label: "Not detected", tone: "gray" };
  }
}

export function contentDiff(entry: ContentEntry): { ai: ContentEntry["value"]; current: ContentEntry["value"]; changed: boolean } {
  const ai = entry.history.find((h) => h.origin === "ai")?.value ?? entry.value;
  return { ai, current: entry.value, changed: JSON.stringify(ai) !== JSON.stringify(entry.value) };
}

export function assetUrl(path: string, base: string): string {
  if (!path) return "";
  if (path.startsWith("blob:") || path.startsWith("data:") || /^https?:\/\//.test(path)) {
    return path;
  }
  return `${base}${path}`;
}

export function displayValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.map(displayValue).join(", ");
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("value" in o && "unit" in o) return `${o.value} ${o.unit}`;
    if ("length" in o && "width" in o) return `${o.length} × ${o.width} × ${o.height} ${o.unit ?? ""}`.trim();
    return JSON.stringify(v);
  }
  return String(v);
}

/** Parse the text a seller typed into the JSON type the attribute expects. */
export function parseAttributeInput(raw: string, dataType: string): unknown {
  const t = raw.trim();
  if (t === "") return null;
  switch (dataType) {
    case "integer":
      return /^-?\d+$/.test(t) ? Number(t) : t;
    case "decimal":
      return Number.isNaN(Number(t)) ? t : Number(t);
    case "boolean":
      return t.toLowerCase() === "yes" || t.toLowerCase() === "true";
    case "multi_select":
    case "array":
      return t.split(",").map((s) => s.trim()).filter(Boolean);
    case "measurement":
    case "weight": {
      const m = /^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/.exec(t);
      return m ? { value: Number(m[1]), unit: m[2] } : t;
    }
    default:
      return t;
  }
}

export const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  running: "Processing",
  analyzed: "Analyzed",
  awaiting_review: "Needs review",
  approved: "Approved",
  rejected: "Rejected",
  failed: "Failed",
  upload_failed: "Upload failed",
};

export const isActive = (status: string) => status === "queued" || status === "running";

export function normalizeQuality(q: Partial<import("./types").ListingResult["quality"]> | undefined) {
  return {
    missing_required: q?.missing_required ?? [],
    unsupported_claims: q?.unsupported_claims ?? {},
    warnings: q?.warnings ?? [],
  };
}
