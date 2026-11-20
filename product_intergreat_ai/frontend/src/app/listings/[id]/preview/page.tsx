"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorState, Loading, Pill, cx } from "@/components/ui";
import { api, API_BASE } from "@/lib/api";
import { assetUrl } from "@/lib/listing";
import type { ListingResult } from "@/lib/types";

export default function ListingMarketplacePreviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>("M");
  const [selectedColor, setSelectedColor] = useState<string>("Black");
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<"specs" | "packaging" | "description" | "seo">("specs");

  const query = useQuery({
    queryKey: ["listing-preview", id],
    queryFn: () => api.get<ListingResult>(`/ai/listings/${id}/result`),
    enabled: !!id,
  });

  const res = query.data;
  const prod = res?.ecommerce_product;

  // Extract photos list
  const photos = useMemo(() => {
    if (!res) return [];
    if (prod?.photos && Array.isArray(prod.photos) && prod.photos.length > 0) {
      return prod.photos;
    }
    if (res.images && res.images.length > 0) {
      return res.images.map((imgId) => `/api/v1/images/${imgId}/file?variant=original`);
    }
    return [];
  }, [res, prod]);

  const primaryPhoto = photos[activeImageIdx] || prod?.photo || "/placeholder.png";

  // Specifications
  const specs = (prod?.specifications as Record<string, unknown>) || {};
  const tiers = (prod?.priceTiers as Array<{ minQuantity: number; maxQuantity: number | null; unitPrice: number; currency: string }>) || [];
  const variants = (prod?.variants as Array<{ type: string; options: string[] }>) || [];
  const packaging = (prod?.packaging as { packageType?: string; boxContents?: string[]; isFragile?: boolean }) || {};

  // Extract variants options
  const colorVariant = variants.find((v) => v.type.toLowerCase() === "color");
  const sizeVariant = variants.find((v) => v.type.toLowerCase() === "size");

  const availableColors = colorVariant?.options?.length ? colorVariant.options : [String(specs["Color"] || "Black")];
  const availableSizes = sizeVariant?.options?.length ? sizeVariant.options : ["S", "M", "L", "XL", "XXL"];

  // Calculate live price based on quantity tiers
  const activeTierPrice = useMemo(() => {
    const basePrice = prod?.price ?? 999;
    if (!tiers.length) return basePrice;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (orderQuantity >= tiers[i].minQuantity) {
        return tiers[i].unitPrice;
      }
    }
    return basePrice;
  }, [tiers, orderQuantity, prod?.price]);

  if (query.isLoading) {
    return (
      <AppShell>
        <Loading />
      </AppShell>
    );
  }

  if (query.isError || !res || !prod) {
    return (
      <AppShell>
        <ErrorState error={query.error || new Error("Failed to load listing result")} retry={() => query.refetch()} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Top Banner indicating Live Marketplace Preview */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 px-5 py-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-lg text-white shadow-xs">
            🛍️
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Live Customer Storefront Preview</h2>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                Prisma Product Ready
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Listing publish hone ke baad marketplace buyers aur wholesale customers ko aapka product aisa dikhega.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/listings/${id}`)}
            className="text-xs font-semibold"
          >
            ← Back to Listing Editor
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => router.push(`/listings/${id}`)}
            className="bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white"
          >
            Approve &amp; Publish Listing
          </Button>
        </div>
      </div>

      {/* Main E-Commerce Product Detail Container */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs font-medium text-slate-500">
          <Link href="/products" className="hover:text-slate-900">
            Marketplace
          </Link>
          <span>/</span>
          <span className="capitalize text-slate-700">{prod.categorySlug.replace(/-/g, " ")}</span>
          <span>/</span>
          <span className="text-slate-700">{prod.subcategory || "Apparel"}</span>
          <span>/</span>
          <span className="truncate max-w-[280px] font-semibold text-slate-900">{prod.name}</span>
        </nav>

        {/* 2-Column Product Detail Layout */}
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Left Column: Multi-Image Photo Gallery */}
          <div className="lg:col-span-6 space-y-4">
            {/* Primary Large Image Frame */}
            <div className="group relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl(primaryPhoto, API_BASE)}
                alt={prod.name}
                className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
              />

              {/* Status Tags */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {prod.readyToShip && (
                  <span className="rounded bg-emerald-600/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs backdrop-blur-xs">
                    Ready to Ship
                  </span>
                )}
                {prod.isNew && (
                  <span className="rounded bg-sky-600/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-xs backdrop-blur-xs">
                    New Arrival
                  </span>
                )}
              </div>

              <div className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-xs">
                Photo {activeImageIdx + 1} of {Math.max(photos.length, 1)}
              </div>
            </div>

            {/* Multi-Image Thumbnails Bar */}
            {photos.length > 1 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-600">Product Views &amp; Details ({photos.length} photos):</p>
                <div className="flex flex-wrap gap-2.5">
                  {photos.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIdx(idx)}
                      className={cx(
                        "relative h-18 w-18 overflow-hidden rounded-lg border-2 bg-slate-50 transition-all",
                        activeImageIdx === idx ? "border-indigo-600 ring-2 ring-indigo-200" : "border-slate-200 hover:border-slate-400"
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={assetUrl(url, API_BASE)}
                        alt={`Thumbnail ${idx + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Buyer Trust & Trade Assurance Banner */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs">
                <div className="font-semibold text-slate-800">🛡️ Trade Assurance</div>
                <p className="mt-0.5 text-[11px] text-slate-500">Full payment protection &amp; verified dispatch.</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs">
                <div className="font-semibold text-slate-800">🧾 Indian GST Compliant</div>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  HSN {prod.hsnCode || "6205"} · GST {Number(prod.gstRate || 5)}% Included
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Title, Pricing Tiers, Variants, and Buy Actions */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              {/* Category & SKU Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-indigo-700">
                  SKU: {prod.sku}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {prod.subcategory || "General"}
                </span>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  ✓ Verified Quality
                </span>
              </div>

              {/* Product Title */}
              <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                {prod.name}
              </h1>

              {/* Customer Rating & Inquiry Count */}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <div className="flex items-center text-amber-500">
                  {"★".repeat(5)}
                </div>
                <span className="font-semibold text-slate-800">4.8</span>
                <span>(128 ratings · 450+ inquiries)</span>
              </div>
            </div>

            {/* Wholesale & Retail Pricing Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Wholesale Unit Price</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      ₹{activeTierPrice.toLocaleString("en-IN")}
                    </span>
                    <span className="text-xs font-medium text-slate-500">/ {prod.unit}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-500">Retail MSRP:</span>
                  <div className="text-sm font-semibold text-slate-700 line-through">
                    ₹{(Number(prod.price) * 1.25).toFixed(0)}
                  </div>
                </div>
              </div>

              {/* B2B Tier Pricing Table */}
              {tiers.length > 0 && (
                <div className="mt-3.5 overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-700">
                        <th className="py-2 px-3">Order Quantity</th>
                        <th className="py-2 px-3">Unit Price (INR)</th>
                        <th className="py-2 px-3 text-right">Wholesale Savings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tiers.map((t, idx) => {
                        const isActive =
                          orderQuantity >= t.minQuantity &&
                          (t.maxQuantity === null || orderQuantity <= t.maxQuantity);
                        return (
                          <tr
                            key={idx}
                            className={cx(
                              "transition-colors",
                              isActive ? "bg-emerald-50 font-semibold text-emerald-950" : "text-slate-700 hover:bg-slate-50/80"
                            )}
                          >
                            <td className="py-2 px-3">
                              {t.minQuantity} {t.maxQuantity ? `– ${t.maxQuantity}` : "+"} {prod.unit}s
                            </td>
                            <td className="py-2 px-3">₹{t.unitPrice.toLocaleString("en-IN")}</td>
                            <td className="py-2 px-3 text-right text-emerald-700">
                              {idx === 0 ? "Standard" : `Save ${Math.round((1 - t.unitPrice / Number(prod.price)) * 100)}%`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Interactive Variants: Color Selection */}
            {availableColors.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Color: <b className="text-slate-900">{selectedColor}</b></span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setSelectedColor(col)}
                      className={cx(
                        "flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-medium transition-all",
                        selectedColor === col
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-200"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      )}
                    >
                      <span
                        className="h-3 w-3 rounded-full border border-black/20"
                        style={{ backgroundColor: col.toLowerCase().includes("black") ? "#111" : col.toLowerCase() }}
                      />
                      {col}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Variants: Size Selection */}
            {availableSizes.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Size: <b className="text-slate-900">{selectedSize}</b></span>
                  <span className="text-[11px] text-indigo-600 cursor-pointer hover:underline">View Size Chart</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableSizes.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={cx(
                        "min-w-[48px] rounded-lg border py-2 text-center text-xs font-bold transition-all",
                        selectedSize === sz
                          ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                      )}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Order Quantity & Stock Info */}
            <div className="flex items-center gap-6 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Quantity ({prod.unit}s):</label>
                <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-xs">
                  <button
                    type="button"
                    onClick={() => setOrderQuantity(Math.max(prod.moq || 1, orderQuantity - 1))}
                    className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-l-lg"
                  >
                    –
                  </button>
                  <input
                    type="number"
                    min={prod.moq || 1}
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(Math.max(prod.moq || 1, parseInt(e.target.value, 10) || prod.moq || 1))}
                    className="w-16 border-x border-slate-200 py-1.5 text-center text-xs font-semibold text-slate-900 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setOrderQuantity(orderQuantity + 1)}
                    className="px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-r-lg"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-0.5">
                <div>Min. Order (MOQ): <b className="text-slate-800">{prod.moq} {prod.unit}</b></div>
                <div>Stock Status: <b className="text-emerald-700">{prod.stock} units in stock</b></div>
                <div>Lead Time: <b className="text-slate-800">{prod.leadTimeDays} business days</b></div>
              </div>
            </div>

            {/* Action Buttons: Buy / RFQ / Sample */}
            <div className="space-y-2.5 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm">
                  ⚡ Start Order ({orderQuantity} {prod.unit}s · ₹{(activeTierPrice * orderQuantity).toLocaleString("en-IN")})
                </Button>
                <Button size="lg" variant="secondary" className="font-semibold text-slate-800 border-slate-300">
                  💬 Contact Supplier
                </Button>
              </div>

              {prod.sampleAvailable && (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/60 px-3.5 py-2 text-xs">
                  <span className="text-amber-900 font-medium">Want to inspect quality before bulk order?</span>
                  <button
                    type="button"
                    className="font-bold text-amber-800 hover:underline cursor-pointer"
                  >
                    Order Sample (₹{Number(prod.samplePrice || prod.price).toLocaleString("en-IN")}) →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Tabs: Specifications, Packaging, Description & SEO */}
        <div className="mt-12 border-t border-slate-200 pt-8">
          <div className="flex border-b border-slate-200 gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("specs")}
              className={cx(
                "pb-3 text-sm font-semibold border-b-2 transition-colors",
                activeTab === "specs"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              🏷️ Specifications ({Object.keys(specs).length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("packaging")}
              className={cx(
                "pb-3 text-sm font-semibold border-b-2 transition-colors",
                activeTab === "packaging"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              📦 Packaging &amp; Logistics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("description")}
              className={cx(
                "pb-3 text-sm font-semibold border-b-2 transition-colors",
                activeTab === "description"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              📝 Description &amp; Highlights
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("seo")}
              className={cx(
                "pb-3 text-sm font-semibold border-b-2 transition-colors",
                activeTab === "seo"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              )}
            >
              🔍 Google SEO Preview
            </button>
          </div>

          <div className="py-6">
            {/* Tab 1: Specifications Table */}
            {activeTab === "specs" && (
              <div className="max-w-4xl">
                <h3 className="text-sm font-bold text-slate-900 mb-3">Key Technical Attributes &amp; Specifications</h3>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <tbody className="divide-y divide-slate-100">
                      <tr className="bg-slate-50/50">
                        <td className="w-1/3 py-2.5 px-4 font-semibold text-slate-600">Material</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {String(specs["Material"] || specs["Fabric Composition"] || "Cotton blend")}
                        </td>
                      </tr>
                      {Object.entries(specs).map(([k, v]) => {
                        if (k.toLowerCase() === "material") return null;
                        return (
                          <tr key={k} className="hover:bg-slate-50/50">
                            <td className="w-1/3 py-2.5 px-4 font-medium text-slate-600">{k}</td>
                            <td className="py-2.5 px-4 text-slate-900 font-semibold">{String(v)}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50/50">
                        <td className="py-2.5 px-4 font-medium text-slate-600">HSN Code</td>
                        <td className="py-2.5 px-4 text-slate-900 font-mono font-semibold">{prod.hsnCode || "6205"}</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-4 font-medium text-slate-600">GST Tax Rate</td>
                        <td className="py-2.5 px-4 text-slate-900 font-semibold">{Number(prod.gstRate || 5)}%</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td className="py-2.5 px-4 font-medium text-slate-600">Net Weight</td>
                        <td className="py-2.5 px-4 text-slate-900 font-semibold">{Number(prod.weightKg || 0.3)} kg</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Packaging & Logistics */}
            {activeTab === "packaging" && (
              <div className="max-w-3xl space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Packaging Information</h3>
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">Package Type:</span>{" "}
                    <span className="text-slate-900">{packaging.packageType || "Standard Retail Packaging"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Box Contents:</span>
                    <ul className="mt-1.5 list-disc pl-5 space-y-1 text-slate-800">
                      {packaging.boxContents?.length ? (
                        packaging.boxContents.map((c, i) => <li key={i}>{c}</li>)
                      ) : (
                        <li>1x {prod.name}</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Dispatch Lead Time:</span>{" "}
                    <span className="text-slate-900">{prod.leadTimeDays} business days</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Detailed Description & Highlights */}
            {activeTab === "description" && (
              <div className="max-w-4xl space-y-6 text-sm text-slate-800">
                {prod.summary && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 font-medium text-indigo-950">
                    {prod.summary}
                  </div>
                )}

                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">Detailed Product Overview</h3>
                  <div className="whitespace-pre-line leading-relaxed text-slate-700 text-sm">
                    {prod.description}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: Google SEO Preview */}
            {activeTab === "seo" && (
              <div className="max-w-2xl space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Live Google Search Snippet Preview</h3>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <span className="h-4 w-4 rounded-full bg-emerald-600 text-center text-[10px] text-white">T</span>
                    <span>https://tradeexpress.com/products/{prod.slug}</span>
                  </div>
                  <h4 className="text-lg font-medium text-blue-700 hover:underline cursor-pointer">
                    {prod.seo?.seoTitle || prod.name}
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {prod.seo?.metaDescription || prod.summary || prod.description?.slice(0, 150)}
                  </p>
                </div>

                {prod.seo?.keywords && prod.seo.keywords.length > 0 && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-slate-700">Target SEO Keywords:</span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {prod.seo.keywords.map((kw, i) => (
                        <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

