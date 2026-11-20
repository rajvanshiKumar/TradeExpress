/** Client for the Form Assistant (via the /api/assist proxy). Deliberately NOT built on lib/api.ts:
 *  that client falls back to mock data when the network fails, which would fake AI suggestions. */

import type { CategoryNode } from "./types";

export type ModuleId = "rfq" | "address" | "vehicle" | "driver";
export type FieldKind = "line" | "area" | "never";

export interface AssistField {
  key: string;
  label: string;
  kind?: FieldKind; // "never" = AI never fills this (shown disabled)
}
export interface ExtraInput {
  id: string;
  label: string;
  rows: number;
  value: string;
}
export interface AssistModule {
  id: ModuleId;
  label: string;
  path: string; // proxy segment, e.g. "rfq"
  title: string;
  hint: string;
  sampleText: string;
  maxImages: number;
  extra: ExtraInput[];
  fields: AssistField[];
}

export interface FieldSuggestion {
  value: string | number;
  confidence: number;
  routing: "prefill" | "confirm";
  reason: string;
}
export interface AssistResponse {
  suggestions: Record<string, FieldSuggestion>;
  skipped: Record<string, string>;
  warnings: string[];
  usage: { provider: string; model: string; prompt_version: string; input_tokens: number; output_tokens: number; latency_ms: number };
}
export interface ImagePayload {
  mime_type: string;
  data_base64: string;
}

export const MODULES: AssistModule[] = [
  {
    id: "rfq",
    label: "RFQ",
    path: "rfq",
    title: "Buyer's requirement",
    hint: "Type the requirement in plain words (English, Hindi or Hinglish).",
    sampleText: "500 pcs steel hex bolts M12, grade 8.8, need in 2 weeks, deliver to Pune 411001",
    maxImages: 0,
    extra: [{ id: "categories", label: "Category list (JSON: slug + name)", rows: 6, value: "" }], // "" = built automatically from the catalog
    fields: [
      { key: "title", label: "Title" },
      { key: "specifications", label: "Specifications", kind: "area" },
      { key: "categorySlug", label: "Category (slug)" },
      { key: "quantity", label: "Quantity" },
      { key: "unit", label: "Unit" },
      { key: "deliveryPincode", label: "Delivery pincode" },
      { key: "destinationCountry", label: "Destination country" },
      { key: "requiredByDate", label: "Required by (YYYY-MM-DD)" },
      { key: "targetPrice", label: "Target price", kind: "never" },
    ],
  },
  {
    id: "address",
    label: "Order address",
    path: "order-address",
    title: "Address / contact text",
    hint: "Paste a WhatsApp message, visiting card or email signature.",
    sampleText:
      "Name: Rahul Sharma\nCompany: Sharma Traders Pvt Ltd\nPhone: +91 98765 43210\nEmail: rahul@sharmatraders.in\nGSTIN: 27AAPFU0939F1ZV\nAddress: Flat 4B, Shiv Residency, Baner Road, Pune, Maharashtra 411045",
    maxImages: 0,
    extra: [],
    fields: [
      { key: "buyerName", label: "Buyer name" },
      { key: "buyerCompany", label: "Buyer company" },
      { key: "buyerPhone", label: "Buyer phone" },
      { key: "buyerEmail", label: "Buyer email" },
      { key: "buyerGstin", label: "Buyer GSTIN" },
      { key: "deliveryAddress.line1", label: "Address line 1" },
      { key: "deliveryAddress.line2", label: "Address line 2" },
      { key: "deliveryAddress.landmark", label: "Landmark" },
      { key: "deliveryAddress.city", label: "City" },
      { key: "deliveryAddress.state", label: "State" },
      { key: "deliveryAddress.pincode", label: "Pincode" },
      { key: "deliveryAddress.country", label: "Country" },
      { key: "total", label: "Total / tax", kind: "never" },
    ],
  },
  {
    id: "vehicle",
    label: "Transport vehicle",
    path: "transport-vehicle",
    title: "Vehicle documents",
    hint: "Upload photos of the RC, insurance, fitness, permit or PUC, and/or paste text.",
    sampleText: "",
    maxImages: 4,
    extra: [{ id: "company", label: "Your company name (only used to suggest ownership)", rows: 1, value: "" }],
    fields: [
      { key: "vehicleNumber", label: "Vehicle number" },
      { key: "make", label: "Make" },
      { key: "model", label: "Model" },
      { key: "yearOfManufacture", label: "Year of manufacture" },
      { key: "ownerName", label: "Owner name" },
      { key: "ownershipType", label: "Ownership type" },
      { key: "rcNumber", label: "RC number" },
      { key: "rcExpiryDate", label: "RC expiry" },
      { key: "insuranceNumber", label: "Insurance number" },
      { key: "insuranceExpiryDate", label: "Insurance expiry" },
      { key: "fitnessExpiryDate", label: "Fitness expiry" },
      { key: "permitNumber", label: "Permit number" },
      { key: "permitType", label: "Permit type" },
      { key: "permitExpiryDate", label: "Permit expiry" },
      { key: "pucExpiryDate", label: "PUC expiry" },
      { key: "vehicleType", label: "Vehicle type" },
      { key: "bodyType", label: "Body type" },
      { key: "capacityTons", label: "Capacity (tons)" },
      { key: "gpsProvider", label: "GPS provider" },
      { key: "gpsImei", label: "GPS IMEI" },
      { key: "isVerified", label: "Verified", kind: "never" },
    ],
  },
  {
    id: "driver",
    label: "Transport driver",
    path: "transport-driver",
    title: "Driver licence",
    hint: "Upload a photo of the driving licence, and/or paste contact text. Photos are sent to the AI provider.",
    sampleText: "",
    maxImages: 2,
    extra: [],
    fields: [
      { key: "name", label: "Driver name" },
      { key: "licenseNumber", label: "Licence number" },
      { key: "licenseType", label: "Licence type" },
      { key: "licenseExpiryDate", label: "Licence expiry" },
      { key: "phone", label: "Phone" },
      { key: "alternatePhone", label: "Alternate phone" },
      { key: "emergencyContactName", label: "Emergency contact name" },
      { key: "emergencyContactPhone", label: "Emergency contact phone" },
      { key: "aadhaarNumber", label: "Aadhaar", kind: "never" },
      { key: "isVerified", label: "Verified", kind: "never" },
    ],
  },
];

export const moduleById = (id: ModuleId): AssistModule => MODULES.find((m) => m.id === id) as AssistModule;

export class AssistError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Form values the user already typed (never-fillable fields excluded), used for skip_filled. */
export function currentValues(mod: AssistModule, values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of mod.fields) {
    const v = values[f.key]?.trim();
    if (f.kind !== "never" && v) out[f.key] = v;
  }
  return out;
}

export interface BuildInput {
  text: string;
  extras: Record<string, string>;
  values: Record<string, string>;
  skipFilled: boolean;
  today?: string;
  images?: ImagePayload[];
}

/** Builds the JSON body for POST /api/assist/<module>/assist. Throws on invalid category JSON. */
export function buildBody(mod: AssistModule, input: BuildInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    text: input.text,
    current_values: currentValues(mod, input.values),
    skip_filled: input.skipFilled,
  };
  if (input.today?.trim()) body.today = input.today.trim();
  if (mod.maxImages > 0) body.images = input.images ?? [];
  if (mod.id === "rfq") {
    let categories: unknown;
    try {
      categories = JSON.parse(input.extras.categories || "[]");
    } catch {
      throw new Error("Category list is not valid JSON");
    }
    if (!Array.isArray(categories)) throw new Error("Category list must be a JSON array");
    body.categories = categories;
  }
  if (mod.id === "vehicle") body.company_name = input.extras.company?.trim() || null;
  return body;
}

export async function callAssist(mod: AssistModule, body: Record<string, unknown>): Promise<AssistResponse> {
  let res: Response;
  try {
    res = await fetch(`/api/assist/${mod.path}/assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AssistError(0, "network", "Could not reach the frontend server.");
  }
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new AssistError(res.status, "bad_response", `Unexpected response (${res.status})`);
  }
  if (!res.ok) {
    const e = (data as { error?: { code?: string; message?: string } } | undefined)?.error;
    throw new AssistError(res.status, e?.code ?? "http_error", e?.message ?? res.statusText);
  }
  return data as AssistResponse;
}

export function fileToImage(file: File): Promise<ImagePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ mime_type: file.type, data_base64: String(reader.result).split(",")[1] ?? "" });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** Fields the AI filled automatically, with the value they had before (for Undo). */
export type AiFilled = Record<string, { prev: string }>;

/** Only what the user typed themselves: AI-filled values must never count as "already filled". */
export function userTypedValues(values: Record<string, string>, aiFilled: AiFilled): Record<string, string> {
  return Object.fromEntries(Object.entries(values).filter(([k]) => !(k in aiFilled)));
}

/**
 * Fills the form with a new set of suggestions. Earlier AI fills are first rolled back to what the
 * user had, so a new request fully replaces the old AI output (no stale values from older text).
 */
export function applySuggestions(
  values: Record<string, string>,
  aiFilled: AiFilled,
  suggestions: Record<string, FieldSuggestion>,
): { values: Record<string, string>; aiFilled: AiFilled } {
  const next = { ...values };
  for (const [k, { prev }] of Object.entries(aiFilled)) next[k] = prev;
  const filled: AiFilled = {};
  for (const [k, s] of Object.entries(suggestions)) {
    filled[k] = { prev: next[k] ?? "" };
    next[k] = String(s.value);
  }
  return { values: next, aiFilled: filled };
}

/** Undo one AI fill (restores the previous value). */
export function undoField(
  values: Record<string, string>,
  aiFilled: AiFilled,
  key: string,
): { values: Record<string, string>; aiFilled: AiFilled } {
  if (!(key in aiFilled)) return { values, aiFilled };
  const { [key]: entry, ...rest } = aiFilled;
  return { values: { ...values, [key]: entry.prev }, aiFilled: rest };
}

/** The user typed in a field: from now on it is theirs, not the AI's. */
export function claimField(aiFilled: AiFilled, key: string): AiFilled {
  if (!(key in aiFilled)) return aiFilled;
  const { [key]: _drop, ...rest } = aiFilled;
  void _drop;
  return rest;
}

/** Category list for the RFQ module, built from the catalog tree: [{slug, name: "Parent > Child"}]. */
export function flattenCategories(tree: CategoryNode[] | undefined, max = 500): { slug: string; name: string }[] {
  const out: { slug: string; name: string }[] = [];
  const seen = new Set<string>();
  const walk = (nodes: CategoryNode[], path: string[]) => {
    for (const n of nodes) {
      if (out.length >= max) return;
      const trail = [...path, n.name];
      if (n.slug && !seen.has(n.slug)) {
        seen.add(n.slug);
        out.push({ slug: n.slug, name: trail.join(" > ") });
      }
      walk(n.children ?? [], trail);
    }
  };
  if (Array.isArray(tree)) walk(tree, []);
  return out;
}
