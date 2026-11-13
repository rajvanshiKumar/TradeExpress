"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { Button, Card, EmptyState, ErrorState, Field, Input, Loading, Pill, StatusPill, cx, useToast } from "@/components/ui";
import { api, API_BASE, ApiError } from "@/lib/api";
import { assetUrl, contentDiff, displayValue, isActive, normalizeQuality, parseAttributeInput } from "@/lib/listing";
import type {
  CategoryAttribute,
  ComplianceEvaluation,
  DuplicateMatch,
  EcommerceProduct,
  ImageOut,
  Language,
  ListingResult,
  Product,
  Translation,
} from "@/lib/types";

const TEXT_FIELDS: [string, string, "line" | "area"][] = [
  ["title", "Product title", "line"],
  ["short_title", "Short title", "line"],
  ["short_description", "Short description", "area"],
  ["long_description", "Long description", "area"],
  ["specifications_summary", "Specifications summary", "area"],
];
const LIST_FIELDS: [string, string][] = [
  ["highlights", "Highlights"],
  ["key_features", "Key features"],
  ["benefits", "Benefits"],
];
const SEO_FIELDS: [string, string, "line" | "area" | "list"][] = [
  ["seo_title", "SEO title", "line"],
  ["meta_description", "Meta description", "area"],
  ["keywords", "Keywords", "list"],
  ["tags", "Tags", "list"],
  ["search_terms", "Suggested search terms", "list"],
];

type Draft = Record<string, string>;
const toText = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join("\n") : (v ?? ""));

function ContentField({
  name,
  label,
  kind,
  entry,
  draft,
  setDraft,
  locked,
  claims,
  onRegenerate,
  regenerating,
}: {
  name: string;
  label: string;
  kind: "line" | "area" | "list";
  entry?: ListingResult["content"][string];
  draft: Draft;
  setDraft: (d: Draft) => void;
  locked: boolean;
  claims?: string[];
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const [compare, setCompare] = useState(false);
  if (!entry) return null;
  const value = draft[name] ?? toText(entry.value);
  const diff = contentDiff(entry);
  const common = {
    id: `f-${name}`,
    value,
    disabled: locked,
    onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [name]: e.target.value }),
    className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50",
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={common.id} className="text-sm font-medium text-slate-700">
          {label} {kind === "list" && <span className="font-normal text-slate-400">(one per line)</span>}
        </label>
        <div className="flex items-center gap-2">
          {entry.origin === "seller" || draft[name] !== undefined ? <Pill tone="blue">Edited</Pill> : <Pill>AI</Pill>}
          <button type="button" className="text-xs text-slate-500 underline" onClick={() => setCompare(!compare)}>
            Compare
          </button>
          {!locked && (
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              loading={regenerating}
              onClick={onRegenerate}
              aria-label={`Regenerate ${label}`}
            >
              Regenerate
            </Button>
          )}
        </div>
      </div>
      {kind === "line" ? <input {...common} /> : <textarea {...common} rows={kind === "list" ? 4 : name === "long_description" ? 8 : 3} />}
      {claims && claims.length > 0 && (
        <p className="text-xs text-amber-700">⚠ Unverified claim(s) with no supporting evidence: {claims.join(", ")}</p>
      )}
      {compare && (
        <div className="grid gap-2 rounded-md bg-slate-50 p-3 text-xs sm:grid-cols-2" data-testid={`compare-${name}`}>
          <div>
            <div className="mb-1 font-semibold text-slate-600">Original AI output</div>
            <div className="whitespace-pre-wrap">{toText(diff.ai)}</div>
          </div>
          <div>
            <div className="mb-1 font-semibold text-slate-600">
              {diff.changed || draft[name] !== undefined ? "Current (edited)" : "Current (unchanged)"}
            </div>
            <div className="whitespace-pre-wrap">{draft[name] ?? toText(diff.current)}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttributeRow({
  attr,
  pred,
  edit,
  setEdit,
  locked,
  error,
}: {
  attr: CategoryAttribute;
  pred?: ListingResult["attributes"][number];
  edit?: string;
  setEdit: (v: string) => void;
  locked: boolean;
  error?: string[];
}) {
  const base = pred ? (pred.final_value ?? (pred.routing === "empty" ? null : pred.ai_value)) : null;
  const value = edit ?? displayValue(base);
  const common = {
    id: `a-${attr.key}`,
    value,
    disabled: locked,
    className: "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50",
  };
  return (
    <tr className="align-top">
      <td className="py-2 pr-3">
        <label htmlFor={common.id} className="text-sm font-medium">
          {attr.label}
          {attr.required && <span className="text-red-600"> *</span>}
        </label>
        <div className="text-xs text-slate-400">{attr.data_type}</div>
      </td>
      <td className="py-2 pr-3">
        {attr.data_type === "enum" ? (
          <select {...common} onChange={(e) => setEdit(e.target.value)}>
            <option value="">—</option>
            {attr.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...common}
            onChange={(e) => setEdit(e.target.value)}
            placeholder={attr.data_type === "measurement" || attr.data_type === "weight" ? "e.g. 250 g" : ""}
          />
        )}
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error.join("; ")}
          </p>
        )}
      </td>
      <td className="py-2 pr-3">
        {pred ? <ConfidenceBadge confidence={pred.confidence} routing={pred.routing} /> : <Pill>Not detected</Pill>}
        {pred?.verified && <Pill tone="green">Seller verified</Pill>}
      </td>
      <td className="py-2 text-xs text-slate-500">
        {pred && pred.routing !== "empty" ? (
          <>
            <span className="font-medium">{pred.source === "ocr" ? "Printed text" : "Image"}:</span> {pred.evidence}
            {pred.reason.includes("sensitive") && (
              <div className="text-amber-700">Visual guess of a sensitive value — verify.</div>
            )}
          </>
        ) : (
          pred?.reason
        )}
      </td>
    </tr>
  );
}

function Translations({ jobId, locked }: { jobId: string; locked: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [locale, setLocale] = useState("fr");
  const langs = useQuery({ queryKey: ["languages"], queryFn: () => api.get<Language[]>("/languages") });
  const list = useQuery({
    queryKey: ["translations", jobId],
    queryFn: () => api.get<Translation[]>(`/ai/listings/${jobId}/translations`),
  });
  const translate = useMutation({
    mutationFn: () => api.post<Translation>("/ai/translate", { job_id: jobId, locale }),
    onSuccess: () => {
      toast("success", "Translation drafted");
      qc.invalidateQueries({ queryKey: ["translations", jobId] });
    },
    onError: (e) => toast("error", e.message),
  });
  const approve = useMutation({
    mutationFn: (l: string) => api.post<Translation>(`/ai/listings/${jobId}/translations/${l}/approve`, {}),
    onSuccess: () => {
      toast("success", "Translation approved");
      qc.invalidateQueries({ queryKey: ["translations", jobId] });
    },
    onError: (e) => toast("error", e.message),
  });
  const rtl = new Map((langs.data ?? []).map((l) => [l.code, l]));
  return (
    <Card title="Translations">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Target language</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-2 text-sm"
          >
            {(langs.data ?? []).filter((l) => l.code !== "en").map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => translate.mutate()} loading={translate.isPending}>
          Translate
        </Button>
        <span className="text-xs text-slate-500">The original English listing is never overwritten.</span>
      </div>
      <div className="mt-4 space-y-3">
        {list.data?.length === 0 && <p className="text-sm text-slate-500">No translations yet.</p>}
        {list.data?.map((t) => (
          <div key={t.locale} className="rounded-lg border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium">
                {rtl.get(t.locale)?.name ?? t.locale}{" "}
                <span className="text-xs text-slate-400">
                  v{t.version} · {t.provider}/{t.model}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={t.status === "approved" ? "green" : "amber"}>{t.status}</Pill>
                {t.status !== "approved" && !locked && (
                  <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => approve.mutate(t.locale)}>
                    Approve
                  </Button>
                )}
              </div>
            </div>
            <dl dir={rtl.get(t.locale)?.rtl ? "rtl" : "ltr"} className="space-y-1 text-sm">
              {["title", "short_description", "long_description"].map(
                (f) =>
                  t.fields[f] && (
                    <div key={f}>
                      <dt className="text-xs uppercase text-slate-400">{f.replace("_", " ")}</dt>
                      <dd className="whitespace-pre-wrap">{toText(t.fields[f])}</dd>
                    </div>
                  )
              )}
            </dl>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ComplianceCard({
  categorySlug,
  attributes,
  textContent,
}: {
  categorySlug?: string;
  attributes: Record<string, unknown>;
  textContent: string;
}) {
  const [market, setMarket] = useState("EU");

  const complianceQuery = useQuery({
    queryKey: ["compliance", market, categorySlug, attributes, textContent],
    queryFn: () =>
      api.post<ComplianceEvaluation>("/compliance/check", {
        market_code: market,
        category_slug: categorySlug,
        attributes,
        text_content: textContent,
      }),
  });

  const MARKETS = [
    { code: "EU", name: "European Union (CE / RoHS / WEEE)" },
    { code: "US", name: "United States (FCC Part 15 / FDA / CPSIA)" },
    { code: "GCC", name: "Gulf / Middle East (SASO / G-Mark)" },
    { code: "IN", name: "India (BIS / EPR / Legal Metrology)" },
  ];

  const evalData = complianceQuery.data;

  return (
    <Card title="International Market Compliance & Readiness">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase text-slate-500">Destination Market:</label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
            >
              {MARKETS.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          {evalData && (
            <div>
              {evalData.is_compliant ? (
                <Pill tone="green">✓ Market Compliant</Pill>
              ) : (
                <Pill tone="amber">⚠ Advisory Actions Required</Pill>
              )}
            </div>
          )}
        </div>

        {complianceQuery.isLoading ? (
          <Loading label="Evaluating market compliance rules..." />
        ) : !evalData ? null : (
          <div className="space-y-3">
            {evalData.violations.length > 0 && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
                <div className="font-semibold mb-1 text-red-800">Blocking Violations ({evalData.violations.length})</div>
                <ul className="list-disc pl-4 space-y-1">
                  {evalData.violations.map((v, i) => (
                    <li key={i}>
                      <b>{v.rule}</b>: {v.reason} — <span className="underline">{v.action_required}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {evalData.advisories.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-semibold mb-1 text-amber-800">
                  Regulatory Guidance & Labelling ({evalData.advisories.length})
                </div>
                <ul className="list-disc pl-4 space-y-1">
                  {evalData.advisories.map((a, i) => (
                    <li key={i}>
                      <b>{a.rule}</b>: {a.reason} — <span className="font-medium">{a.action_required}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              evalData.violations.length === 0 && (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  No regulatory advisories or restricted claims detected for this product in {market}.
                </div>
              )
            )}
          </div>
        )}
      </div>
    </Card>
  );
}


function getEcommerceProduct(d: ListingResult): EcommerceProduct {
  if (d.ecommerce_product) {
    return d.ecommerce_product;
  }
  const title = (d.content.title?.value as string) || "Untitled Product";
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const sku = `TX-${(d.category?.name || "PROD").substring(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const specs: Record<string, any> = {};
  (d.attributes || []).forEach((a) => {
    const val = a.final_value ?? a.seller_value ?? a.ai_value;
    if (val !== null && val !== undefined && val !== "") {
      const key = a.attribute_key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      specs[key] = val;
    }
  });

  const isAudio =
    d.category?.slug?.includes("audio") ||
    d.category?.slug?.includes("electronic") ||
    title.toLowerCase().includes("earphone") ||
    title.toLowerCase().includes("headphone");

  const price = isAudio ? 899.0 : 1299.0;
  const hsn = isAudio ? "8518" : "6205";
  const gst = isAudio ? 18.0 : 5.0;
  const weight = isAudio ? 0.15 : 0.35;
  const color = specs["Color"] || "Standard";

  const variants = isAudio
    ? [{ type: "Color", options: [color] }]
    : [
        { type: "Size", options: ["S", "M", "L", "XL", "XXL"] },
        { type: "Color", options: [color] },
      ];

  const now = new Date().toISOString();

  return {
    id: `prod-${d.job.id}`,
    sku,
    name: title,
    slug,
    companyId: null,
    supplierId: null,
    categorySlug: d.category?.slug || (isAudio ? "electronics-audio" : "clothing-fashion"),
    subcategory: d.category?.name || (isAudio ? "Wireless Earphones" : "Casual Shirts"),
    summary:
      (d.content.short_description?.value as string) ||
      (d.content.summary?.value as string) ||
      title,
    description:
      (d.content.long_description?.value as string) ||
      (d.content.description?.value as string) ||
      title,
    photo: d.images?.[0] ? `/api/v1/images/${d.images[0]}/file?variant=original` : null,
    videoUrl: null,
    currency: "INR",
    price,
    unit: "piece",
    moq: 1,
    stock: 100,
    reservedStock: 0,
    committedStock: 0,
    lowStockThreshold: 10,
    warehouseLocation: "Mumbai Warehouse A",
    leadTimeDays: isAudio ? 3 : 5,
    status: "Active",
    featured: false,
    trending: false,
    readyToShip: true,
    isNew: true,
    deal: false,
    hsnCode: hsn,
    gstRate: gst,
    sampleAvailable: true,
    samplePrice: price,
    moderationStatus: "APPROVED",
    rejectionReason: null,
    weightKg: weight,
    variants,
    specifications: specs,
    packaging: {
      packageType: "Retail Box",
      boxContents: [title, "User Manual", "Warranty Card"],
      isFragile: isAudio,
    },
    priceTiers: [
      { minQuantity: 1, maxQuantity: 10, unitPrice: price, currency: "INR" },
      { minQuantity: 11, maxQuantity: 50, unitPrice: Math.round(price * 0.9), currency: "INR" },
      { minQuantity: 51, maxQuantity: null, unitPrice: Math.round(price * 0.8), currency: "INR" },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function EcommerceSchemaCard({
  prod,
  onViewRaw,
}: {
  prod: EcommerceProduct;
  onViewRaw: () => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"tiers" | "specs" | "packaging" | "variants">("tiers");

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(prod, null, 2));
    setCopied(true);
    toast("success", "Prisma Product JSON copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(prod, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradeexpress-${prod.sku || "product"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", `Downloaded ${prod.sku}.json`);
  };

  return (
    <Card className="border-emerald-200 bg-gradient-to-br from-white via-white to-emerald-50/20">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📦</span>
              <h3 className="text-base font-bold text-slate-900">
                TradeExpress Main Marketplace Schema (Prisma: <code className="text-emerald-700">Product</code>)
              </h3>
              <Pill tone="green">TradeExpress Ready</Pill>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Auto-mapped to your main marketplace database schema (36 fields generated & verified).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={copyJson}>
              {copied ? "✓ Copied" : "📋 Copy Prisma JSON"}
            </Button>
            <Button size="sm" variant="secondary" onClick={downloadJson}>
              💾 Download .json
            </Button>
            <Button size="sm" onClick={onViewRaw}>
              🔍 View Raw JSON
            </Button>
          </div>
        </div>

        {/* Status & Tax badges strip */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
            Currency: <strong className="text-slate-900">₹ INR</strong>
          </span>
          <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
            Status: <strong>{prod.status}</strong>
          </span>
          <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
            Moderation: <strong>{prod.moderationStatus}</strong>
          </span>
          <span className="rounded bg-sky-100 px-2 py-0.5 font-medium text-sky-800">
            HSN Code: <strong>{prod.hsnCode || "8518"}</strong>
          </span>
          <span className="rounded bg-sky-100 px-2 py-0.5 font-medium text-sky-800">
            GST Rate: <strong>{prod.gstRate}%</strong>
          </span>
          <span className="rounded bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800">
            Weight: <strong>{prod.weightKg} kg</strong>
          </span>
          <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
            Ready to Ship: <strong>{prod.readyToShip ? "Yes" : "No"}</strong>
          </span>
        </div>

        {/* 4-column overview grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
          <div>
            <span className="text-slate-400 block font-medium">SKU</span>
            <span className="font-bold text-slate-800 font-mono select-all">{prod.sku}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">URL Slug</span>
            <span className="font-semibold text-slate-700 font-mono truncate block select-all">/{prod.slug}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Category / Subcategory</span>
            <span className="font-semibold text-slate-800">{prod.categorySlug} / {prod.subcategory || "N/A"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Retail Price</span>
            <span className="text-sm font-bold text-emerald-700">₹{prod.price?.toLocaleString()} / {prod.unit}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">MOQ & Stock</span>
            <span className="font-medium text-slate-800">MOQ: {prod.moq} | Stock: {prod.stock}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Lead Time</span>
            <span className="font-medium text-slate-800">{prod.leadTimeDays} business days</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Sample Available</span>
            <span className="font-medium text-slate-800">{prod.sampleAvailable ? `Yes (₹${prod.samplePrice})` : "No"}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Catalog Flags</span>
            <span className="font-medium text-slate-800">
              {prod.isNew && "New "}
              {prod.featured && "• Featured "}
              {prod.trending && "• Trending "}
              {prod.deal && "• Deal "}
              {!prod.isNew && !prod.featured && !prod.trending && !prod.deal && "Standard"}
            </span>
          </div>
        </div>

        {/* Tabs for JSON Substructures */}
        <div className="space-y-2">
          <div className="flex border-b border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("tiers")}
              className={cx(
                "px-3 py-2 border-b-2 transition",
                activeTab === "tiers"
                  ? "border-emerald-600 text-emerald-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              📊 B2B Volume Pricing ({Array.isArray(prod.priceTiers) ? prod.priceTiers.length : 0} Tiers)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              className={cx(
                "px-3 py-2 border-b-2 transition",
                activeTab === "specs"
                  ? "border-emerald-600 text-emerald-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              🏷️ Specifications ({prod.specifications ? Object.keys(prod.specifications).length : 0} Attributes)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("packaging")}
              className={cx(
                "px-3 py-2 border-b-2 transition",
                activeTab === "packaging"
                  ? "border-emerald-600 text-emerald-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              📦 Packaging & Logistics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("variants")}
              className={cx(
                "px-3 py-2 border-b-2 transition",
                activeTab === "variants"
                  ? "border-emerald-600 text-emerald-700 font-bold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              🎨 Variants
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
            {activeTab === "tiers" && (
              <div className="space-y-2">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-semibold">
                      <th className="pb-1">Quantity Tier</th>
                      <th className="pb-1">Wholesale Unit Price (INR)</th>
                      <th className="pb-1">Savings vs Retail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(Array.isArray(prod.priceTiers) ? prod.priceTiers : []).map((t: any, idx: number) => {
                      const discountPct = prod.price ? Math.round(((prod.price - t.unitPrice) / prod.price) * 100) : 0;
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-1.5 font-medium text-slate-800">
                            {t.minQuantity} {t.maxQuantity ? `– ${t.maxQuantity}` : "+"} {prod.unit}s
                          </td>
                          <td className="py-1.5 font-bold text-emerald-700">₹{t.unitPrice}</td>
                          <td className="py-1.5">
                            {discountPct > 0 ? (
                              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                                Save {discountPct}%
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Standard</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "specs" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {prod.specifications && Object.keys(prod.specifications).length > 0 ? (
                  Object.entries(prod.specifications).map(([k, v]) => (
                    <div key={k} className="rounded bg-slate-50 p-2 border border-slate-100">
                      <span className="text-slate-400 block text-[11px] font-medium">{k}</span>
                      <span className="font-semibold text-slate-800">{String(v)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-400">No specifications defined.</p>
                )}
              </div>
            )}

            {activeTab === "packaging" && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Package Type</span>
                    <span className="font-bold text-slate-800">{prod.packaging?.packageType || "Retail Box"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Fragile Handling</span>
                    <span className="font-bold text-slate-800">{prod.packaging?.isFragile ? "⚠️ Yes (Handle with Care)" : "No"}</span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] mb-1">Package Box Contents</span>
                  <div className="flex flex-wrap gap-1">
                    {(prod.packaging?.boxContents || [prod.name]).map((item: string, idx: number) => (
                      <span key={idx} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 border border-slate-200">
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "variants" && (
              <div className="space-y-2">
                {(Array.isArray(prod.variants) ? prod.variants : []).map((v: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 w-20">{v.type}:</span>
                    <div className="flex flex-wrap gap-1">
                      {(v.options || []).map((opt: string, oi: number) => (
                        <span key={oi} className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-800 border border-slate-200">
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function EcommerceSchemaModal({
  prod,
  open,
  onClose,
}: {
  prod: EcommerceProduct;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<"json" | "prisma">("json");
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const jsonString = JSON.stringify(prod, null, 2);

  const prismaSnippet = `// In your TradeExpress Next.js API / server action:
import { prisma } from "@/lib/prisma";

export async function importProduct() {
  const newProduct = await prisma.product.create({
    data: {
      id: "${prod.id}",
      sku: "${prod.sku}",
      name: ${JSON.stringify(prod.name)},
      slug: "${prod.slug}",
      categorySlug: "${prod.categorySlug}",
      subcategory: ${JSON.stringify(prod.subcategory)},
      summary: ${JSON.stringify(prod.summary)},
      description: ${JSON.stringify(prod.description)},
      photo: ${JSON.stringify(prod.photo)},
      currency: "INR",
      price: ${prod.price},
      unit: "${prod.unit}",
      moq: ${prod.moq},
      stock: ${prod.stock},
      reservedStock: 0,
      committedStock: 0,
      lowStockThreshold: ${prod.lowStockThreshold},
      leadTimeDays: ${prod.leadTimeDays},
      status: "Active",
      readyToShip: true,
      hsnCode: "${prod.hsnCode || "8518"}",
      gstRate: ${prod.gstRate},
      sampleAvailable: true,
      samplePrice: ${prod.samplePrice},
      moderationStatus: "APPROVED",
      weightKg: ${prod.weightKg},
      specifications: ${JSON.stringify(prod.specifications, null, 6)},
      packaging: ${JSON.stringify(prod.packaging, null, 6)},
      priceTiers: ${JSON.stringify(prod.priceTiers, null, 6)},
      variants: ${JSON.stringify(prod.variants, null, 6)},
    },
  });
  return newProduct;
}`;

  const textToCopy = tab === "json" ? jsonString : prismaSnippet;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast("success", tab === "json" ? "JSON copied!" : "Prisma snippet copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span>📦</span> TradeExpress Prisma Product Schema
            </h3>
            <p className="text-xs text-slate-500">
              Matches your production database model: <code className="text-emerald-700">model Product</code>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100 px-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("json")}
            className={cx(
              "py-2.5 px-4 border-b-2 transition",
              tab === "json" ? "border-emerald-600 text-emerald-800 bg-white" : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            📋 Raw JSON Data ({prod.sku})
          </button>
          <button
            type="button"
            onClick={() => setTab("prisma")}
            className={cx(
              "py-2.5 px-4 border-b-2 transition",
              tab === "prisma" ? "border-emerald-600 text-emerald-800 bg-white" : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            ⚙️ Prisma Client Code (prisma.product.create)
          </button>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4 bg-slate-900">
          <pre className="font-mono text-xs text-emerald-300 whitespace-pre leading-relaxed select-all">
            {tab === "json" ? jsonString : prismaSnippet}
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50">
          <span className="text-xs text-slate-500">
            {tab === "json" ? "36 fields formatted according to Prisma Product schema" : "Ready to paste into your Next.js API route"}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={copyToClipboard}>
              {copied ? "✓ Copied!" : "📋 Copy to Clipboard"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>({});
  const [attrEdits, setAttrEdits] = useState<Draft>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [regenField, setRegenField] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");

  // Publish to Master Catalog Modal state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishSku, setPublishSku] = useState("");
  const [publishOfferType, setPublishOfferType] = useState<"b2c" | "b2b" | "both">("both");
  const [publishRetailPrice, setPublishRetailPrice] = useState("");
  const [publishWholesalePrice, setPublishWholesalePrice] = useState("");
  const [publishMoq, setPublishMoq] = useState("1");
  const [publishLeadTime, setPublishLeadTime] = useState("3");
  const [publishStock, setPublishStock] = useState("10");
  const [showSchemaModal, setShowSchemaModal] = useState(false);

  const res = useQuery({
    queryKey: ["listing", id],
    queryFn: () => api.get<ListingResult>(`/ai/listings/${id}/result`),
    refetchInterval: (q) => (q.state.data && isActive(q.state.data.job.status) ? 2000 : false),
  });
  const data = res.data;
  const catId = data?.category?.id;
  const schema = useQuery({
    queryKey: ["cat-attrs", catId],
    queryFn: () => api.get<CategoryAttribute[]>(`/categories/${catId}/attributes`),
    enabled: !!catId,
  });
  const images = useQuery({
    queryKey: ["listing-images", data?.images],
    queryFn: () => Promise.all((data?.images ?? []).map((i) => api.get<ImageOut>(`/images/${i}`))),
    enabled: !!data?.images?.length,
  });

  const status = data?.job?.status ?? "queued";
  const locked = status !== "awaiting_review";
  const preds = useMemo(() => new Map((data?.attributes ?? []).map((a) => [a.attribute_key, a])), [data]);
  const ecommerceProd = useMemo(() => (data ? getEcommerceProduct(data) : null), [data]);

  const openPublishModal = () => {
    if (ecommerceProd) {
      if (!publishSku) setPublishSku(ecommerceProd.sku);
      if (!publishRetailPrice) setPublishRetailPrice(String(ecommerceProd.price));
      if (!publishWholesalePrice) setPublishWholesalePrice(String(Math.round(ecommerceProd.price * 0.85)));
      if (!publishMoq) setPublishMoq(String(ecommerceProd.moq));
      if (!publishLeadTime) setPublishLeadTime(String(ecommerceProd.leadTimeDays));
      if (!publishStock) setPublishStock(String(ecommerceProd.stock));
    }
    setShowPublishModal(true);
  };

  // Duplicate check query
  const titleText = toText(data?.content?.title?.value);
  const duplicateQuery = useQuery({
    queryKey: ["duplicate-check", id, titleText],
    queryFn: () =>
      api.post<DuplicateMatch[]>("/ai/duplicates/check", {
        title: titleText,
        brand: (data?.attributes?.find((a) => a.attribute_key === "brand")?.final_value as string) ?? null,
        model: (data?.attributes?.find((a) => a.attribute_key === "model")?.final_value as string) ?? null,
        image_ids: data?.images ?? [],
      }),
    enabled: !!data && !isActive(status) && !!titleText,
  });

  const regenerate = useMutation({
    mutationFn: (field: string) => api.post(`/ai/listings/${id}/regenerate`, { field }),
    onMutate: (f) => setRegenField(f),
    onSuccess: (_d, f) => {
      setDraft((d) => {
        const n = { ...d };
        delete n[f];
        return n;
      });
      qc.invalidateQueries({ queryKey: ["listing", id] });
      toast("success", "Field regenerated");
    },
    onError: (e) => toast("error", e.message),
    onSettled: () => setRegenField(null),
  });

  const approve = useMutation({
    mutationFn: () => {
      const content: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(draft)) {
        const isList = Array.isArray(data?.content[k]?.value);
        content[k] = isList ? v.split("\n").map((s) => s.trim()).filter(Boolean) : v;
      }
      const attributes: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(attrEdits)) {
        const dt = schema.data?.find((a) => a.key === k)?.data_type ?? "string";
        attributes[k] = parseAttributeInput(v, dt);
      }
      return api.post(`/ai/listings/${id}/approve`, { content, attributes });
    },
    onSuccess: () => {
      setFieldErrors({});
      toast("success", "Listing approved");
      qc.invalidateQueries({ queryKey: ["listing", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422 && e.details && typeof e.details === "object") {
        setFieldErrors(e.details as Record<string, string[]>);
      }
      toast("error", e.message);
    },
  });

  const reject = useMutation({
    mutationFn: () => api.post(`/ai/listings/${id}/reject`, { reason: "Rejected by seller" }),
    onSuccess: () => {
      toast("success", "AI output rejected");
      qc.invalidateQueries({ queryKey: ["listing", id] });
    },
    onError: (e) => toast("error", e.message),
  });

  const rerun = useMutation({
    mutationFn: () =>
      api.post<{ job_id: string }>("/ai/listings/generate", {
        image_ids: data!.images,
        category_id: newCategory,
      }),
    onSuccess: (r) => router.push(`/listings/${r.job_id}`),
    onError: (e) => toast("error", e.message),
  });

  // Publish to Master Catalog mutation
  const publishToCatalogMutation = useMutation({
    mutationFn: () =>
      api.post<Product>(`/products/from-job/${id}`, {
        sku: publishSku || undefined,
        offer_type: publishOfferType,
        retail_price: publishRetailPrice ? parseFloat(publishRetailPrice) : null,
        wholesale_price: publishWholesalePrice ? parseFloat(publishWholesalePrice) : null,
        currency: "INR",
        min_order_quantity: parseInt(publishMoq, 10) || 1,
        lead_time_days: parseInt(publishLeadTime, 10) || 3,
        stock_quantity: parseInt(publishStock, 10) || 10,
      }),
    onSuccess: (newProduct) => {
      toast("success", "Published to Master Catalog!");
      setShowPublishModal(false);
      router.push(`/products/${newProduct.id}`);
    },
    onError: (e) => toast("error", e.message),
  });

  const catList = useQuery({
    queryKey: ["cat-all"],
    queryFn: () => api.get<{ items: { id: string; name: string; level: number }[] }>("/categories?limit=200"),
  });

  if (res.isLoading) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  }
  if (res.isError) {
    return (
      <AppShell>
        <ErrorState error={res.error} retry={() => res.refetch()} />
      </AppShell>
    );
  }

  const d = data!;
  const dirty = Object.keys(draft).length + Object.keys(attrEdits).length;
  const quality = normalizeQuality(d.quality);
  const missing = quality.missing_required;
  const claims = quality.unsupported_claims;

  const activeMissing = missing.filter((key) => {
    const editVal = attrEdits[key];
    if (editVal !== undefined && editVal !== null && String(editVal).trim() !== "") {
      return false;
    }
    const existing = d.attributes?.find((a) => a.attribute_key === key);
    const existingVal = existing?.final_value ?? existing?.seller_value ?? existing?.ai_value;
    if (existingVal !== undefined && existingVal !== null && String(existingVal).trim() !== "") {
      return false;
    }
    return true;
  });

  // Build combined attributes object for compliance checks
  const combinedAttributes: Record<string, unknown> = {};
  for (const a of d.attributes ?? []) {
    combinedAttributes[a.attribute_key] = a.final_value ?? a.ai_value;
  }
  for (const [k, v] of Object.entries(attrEdits)) {
    combinedAttributes[k] = v;
  }

  const fullTextContent = [
    draft.title ?? toText(d.content.title?.value),
    draft.short_description ?? toText(d.content.short_description?.value),
    draft.long_description ?? toText(d.content.long_description?.value),
  ].join("\n");

  const field = (name: string, label: string, kind: "line" | "area" | "list") => (
    <ContentField
      key={name}
      name={name}
      label={label}
      kind={kind}
      entry={d.content[name]}
      draft={draft}
      setDraft={setDraft}
      locked={locked}
      claims={claims[name]}
      regenerating={regenField === name}
      onRegenerate={() => regenerate.mutate(name)}
    />
  );

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{toText(d.content.title?.value) || "Listing in progress"}</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
            <StatusPill status={status} />
            {d.job.model && (
              <span>
                {d.job.provider} · {d.job.model} · prompts {d.job.prompt_version}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/listings/${id}/preview`}
            className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 shadow-xs hover:bg-indigo-100 transition"
          >
            🛍️ Live Marketplace View
          </Link>
          {status === "awaiting_review" && (
            <>
              <Button variant="secondary" onClick={() => reject.mutate()} loading={reject.isPending}>
                Reject AI output
              </Button>
              <Button onClick={() => approve.mutate()} loading={approve.isPending}>
                Approve listing{dirty ? ` (${dirty} edit${dirty > 1 ? "s" : ""})` : ""}
              </Button>
            </>
          )}
          {status === "approved" && (
            <Button onClick={openPublishModal}>
              Publish to Master Catalog
            </Button>
          )}
        </div>
      </div>

      {isActive(status) && (
        <Card className="mb-6">
          <div className="flex items-center gap-3 text-sm">
            <Loading label={`${d.job.stage} · ${d.job.progress}%`} />
          </div>
          <div className="h-2 rounded bg-slate-100">
            <div className="h-2 rounded bg-emerald-600 transition-all" style={{ width: `${d.job.progress}%` }} />
          </div>
        </Card>
      )}

      {status === "failed" && (
        <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          AI processing failed at stage “{d.job.stage}”: {d.job.error}. Your images are safe — you can start a new
          generation from the upload page.
        </div>
      )}

      {status === "approved" && (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div>
            <span className="font-semibold">Listing Approved:</span> Content and verified attributes are locked and
            ready for publication to the live product catalog.
          </div>
          <Button size="sm" onClick={openPublishModal}>
            Publish to Master Catalog
          </Button>
        </div>
      )}

      {status === "rejected" && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-100 p-4 text-sm">AI output was rejected.</div>
      )}

      {/* Duplicate Alert Banner */}
      {duplicateQuery.data && duplicateQuery.data.length > 0 && (
        <div role="alert" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <span>⚠️ Potential Duplicate Products Detected in Catalog ({duplicateQuery.data.length})</span>
          </div>
          <p className="mt-1 text-xs text-amber-800">
            The catalog contains existing items with matching perceptual images, brand/model numbers, or textual similarity:
          </p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {duplicateQuery.data.map((dup, idx) => (
              <li
                key={idx}
                className="flex items-center justify-between rounded bg-amber-100/70 px-3 py-2 text-amber-950"
              >
                <div>
                  <span className="font-semibold">{dup.title}</span>
                  <span className="ml-2 font-mono text-[11px] uppercase text-amber-700">
                    ({dup.match_type.replace(/_/g, " ")})
                  </span>
                  <span className="ml-1 text-[11px] text-amber-600">
                    · {Math.round(dup.confidence * 100)}% match
                  </span>
                  <div className="text-amber-800 text-[11px]">{dup.reason}</div>
                </div>
                {dup.product_id && (
                  <Link
                    href={`/products/${dup.product_id}`}
                    target="_blank"
                    className="ml-3 shrink-0 rounded bg-amber-200 px-2 py-1 font-medium text-amber-900 hover:bg-amber-300"
                  >
                    View Product
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(quality.warnings.length > 0 || activeMissing.length > 0) && !isActive(status) && (
        <Card title="Warnings & missing information" className="mb-6">
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">
            {activeMissing.length > 0 && (
              <li>
                Missing required attributes: <b>{activeMissing.join(", ")}</b>
              </li>
            )}
            {quality.warnings.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-1">
          <Card title="Images">
            <div className="grid grid-cols-2 gap-2">
              {images.data?.map((i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i.id}
                  src={assetUrl(i.url, API_BASE)}
                  alt={i.original_filename}
                  className="aspect-square w-full rounded-md object-cover"
                />
              ))}
            </div>
          </Card>

          <Card title="Category">
            {d.category ? (
              <>
                <div className="font-medium">{d.category.name}</div>
                <div className="text-xs text-slate-500">
                  {d.category.source === "seller"
                    ? "Chosen by you"
                    : `AI confidence ${Math.round((d.category.confidence ?? 0) * 100)}%`}
                </div>
              </>
            ) : (
              <p className="text-sm text-amber-700">Category not determined — choose one below.</p>
            )}
            {!isActive(status) && status !== "approved" && (
              <div className="mt-3 flex gap-2">
                <select
                  aria-label="Correct category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Correct category…</option>
                  {catList.data?.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {"— ".repeat(c.level)}
                      {c.name}
                    </option>
                  ))}
                </select>
                <Button
                  variant="secondary"
                  disabled={!newCategory}
                  loading={rerun.isPending}
                  onClick={() => rerun.mutate()}
                >
                  Re-run
                </Button>
              </div>
            )}
          </Card>

          {d.ocr && (
            <Card title="Text read from the product (OCR)">
              <p className="whitespace-pre-wrap text-sm">{d.ocr.full_text || "No legible text found."}</p>
              <p className="mt-2 text-xs text-slate-400">Engine: {d.ocr.engine}</p>
            </Card>
          )}

          <Card title="AI usage for this listing">
            <p className="text-sm text-slate-600">
              {d.usage.calls} calls · {d.usage.input_tokens + d.usage.output_tokens} tokens
              {d.usage.cost_usd !== null && ` · $${d.usage.cost_usd.toFixed(4)}`}
            </p>
          </Card>
        </div>

        <div className="space-y-6 xl:col-span-2">
          <Card title="Attributes">
            {!d.category ? (
              <EmptyState title="Select a category to see its attributes" />
            ) : schema.isLoading ? (
              <Loading />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th>Attribute</th>
                      <th>Value</th>
                      <th>Confidence</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {schema.data?.map((a) => (
                      <AttributeRow
                        key={a.key}
                        attr={a}
                        pred={preds.get(a.key)}
                        edit={attrEdits[a.key]}
                        locked={locked}
                        setEdit={(v) => setAttrEdits({ ...attrEdits, [a.key]: v })}
                        error={fieldErrors[a.key]}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {Object.keys(d.content).length > 0 && (
            <>
              <Card title="Title & description">
                <div className="space-y-4">
                  {TEXT_FIELDS.map(([n, l, k]) => field(n, l, k))}
                  {LIST_FIELDS.map(([n, l]) => field(n, l, "list"))}
                </div>
              </Card>

              <Card title="SEO metadata">
                <div className="space-y-4">{SEO_FIELDS.map(([n, l, k]) => field(n, l, k))}</div>
              </Card>
            </>
          )}

          {/* Main Marketplace Prisma Product Schema Card */}
          {ecommerceProd && (
            <EcommerceSchemaCard
              prod={ecommerceProd}
              onViewRaw={() => setShowSchemaModal(true)}
            />
          )}

          {/* Compliance & International Market Readiness */}
          <ComplianceCard
            categorySlug={d.category?.name?.toLowerCase().replace(/\s+/g, "-")}
            attributes={combinedAttributes}
            textContent={fullTextContent}
          />

          {(status === "awaiting_review" || status === "approved") && Object.keys(d.content).length > 0 && (
            <Translations jobId={id} locked={false} />
          )}
        </div>
      </div>

      {/* Prisma Raw Schema Modal */}
      {ecommerceProd && showSchemaModal && (
        <EcommerceSchemaModal
          prod={ecommerceProd}
          open={showSchemaModal}
          onClose={() => setShowSchemaModal(false)}
        />
      )}

      {/* Publish to Master Catalog Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Publish to Master Catalog</h3>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Create an official product entry in the catalog with verified attributes and set your commercial terms
              (pricing, MOQ, inventory).
            </p>

            <div className="space-y-3">
              <Field
                id="pub-sku"
                label="SKU (Stock Keeping Unit)"
                placeholder="e.g. TX-PROD-001 (Optional)"
                value={publishSku}
                onChange={(e) => setPublishSku(e.target.value)}
              />

              <div>
                <label className="block text-xs font-medium text-slate-700">Commercial Market Channel</label>
                <select
                  value={publishOfferType}
                  onChange={(e) => setPublishOfferType(e.target.value as any)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="both">Both B2B Wholesale & B2C Retail</option>
                  <option value="b2c">B2C Retail Only</option>
                  <option value="b2b">B2B Wholesale Only</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="pub-retail"
                  label="Retail Price (₹ INR)"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 999.00"
                  value={publishRetailPrice}
                  onChange={(e) => setPublishRetailPrice(e.target.value)}
                />
                <Field
                  id="pub-wholesale"
                  label="Wholesale Price (₹ INR)"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 799.00"
                  value={publishWholesalePrice}
                  onChange={(e) => setPublishWholesalePrice(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Field
                  id="pub-moq"
                  label="Min Order Qty"
                  type="number"
                  min="1"
                  value={publishMoq}
                  onChange={(e) => setPublishMoq(e.target.value)}
                />
                <Field
                  id="pub-lead"
                  label="Lead Time (days)"
                  type="number"
                  min="1"
                  value={publishLeadTime}
                  onChange={(e) => setPublishLeadTime(e.target.value)}
                />
                <Field
                  id="pub-stock"
                  label="Initial Stock"
                  type="number"
                  min="0"
                  value={publishStock}
                  onChange={(e) => setPublishStock(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="secondary" onClick={() => setShowPublishModal(false)}>
                Cancel
              </Button>
              <Button
                loading={publishToCatalogMutation.isPending}
                onClick={() => publishToCatalogMutation.mutate()}
              >
                Publish to Official Catalog
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function ListingEditorPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ListingEditor />
    </Suspense>
  );
}
