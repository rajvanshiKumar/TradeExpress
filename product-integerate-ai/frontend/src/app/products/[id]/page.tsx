"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button, Card, EmptyState, ErrorState, Field, Input, Loading, Pill, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import type { PricingTier, Product, ProductVariant, SellerOffer } from "@/lib/types";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const [showAddVariant, setShowAddVariant] = useState(false);
  const [variantSku, setVariantSku] = useState("");
  const [variantName, setVariantName] = useState("");
  const [variantBarcode, setVariantBarcode] = useState("");

  const [showAddOffer, setShowAddOffer] = useState(false);
  const [offerType, setOfferType] = useState<"b2c" | "b2b" | "both">("both");
  const [retailPrice, setRetailPrice] = useState("");
  const [wholesalePrice, setWholesalePrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [moq, setMoq] = useState("1");
  const [stock, setStock] = useState("10");
  const [leadTime, setLeadTime] = useState("3");
  const [offerNotes, setOfferNotes] = useState("");

  const [selectedOfferForTier, setSelectedOfferForTier] = useState<string | null>(null);
  const [tierMinQty, setTierMinQty] = useState("10");
  const [tierMaxQty, setTierMaxQty] = useState("");
  const [tierPrice, setTierPrice] = useState("");

  // Product Query
  const productQuery = useQuery({
    queryKey: ["product", id],
    queryFn: () => api.get<Product>(`/products/${id}`),
    enabled: !!id,
  });

  // Offers Query
  const offersQuery = useQuery({
    queryKey: ["product-offers", id],
    queryFn: () => api.get<SellerOffer[]>(`/offers?product_id=${id}`),
    enabled: !!id,
  });

  // Publish / Archive mutations
  const publishMutation = useMutation({
    mutationFn: () => api.post(`/products/${id}/publish`),
    onSuccess: () => {
      toast("success", "Product published to catalog");
      qc.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (e) => toast("error", e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: () => api.post(`/products/${id}/archive`),
    onSuccess: () => {
      toast("success", "Product archived");
      qc.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (e) => toast("error", e.message),
  });

  // Add Variant mutation
  const addVariantMutation = useMutation({
    mutationFn: (data: { sku: string; variant_name: string; barcode?: string }) =>
      api.post(`/products/${id}/variants`, {
        sku: data.sku,
        variant_name: data.variant_name,
        barcode: data.barcode || null,
        attributes: {},
        is_active: true,
      }),
    onSuccess: () => {
      toast("success", "Variant added");
      setShowAddVariant(false);
      setVariantSku("");
      setVariantName("");
      setVariantBarcode("");
      qc.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (e) => toast("error", e.message),
  });

  // Add Offer mutation
  const addOfferMutation = useMutation({
    mutationFn: () =>
      api.post("/offers", {
        product_id: id,
        offer_type: offerType,
        retail_price: retailPrice ? parseFloat(retailPrice) : null,
        wholesale_price: wholesalePrice ? parseFloat(wholesalePrice) : null,
        currency,
        min_order_quantity: parseInt(moq, 10) || 1,
        stock_quantity: parseInt(stock, 10) || 0,
        lead_time_days: parseInt(leadTime, 10) || 1,
        notes: offerNotes || null,
        is_available: true,
        pricing_tiers: [],
      }),
    onSuccess: () => {
      toast("success", "Commercial offer created");
      setShowAddOffer(false);
      setRetailPrice("");
      setWholesalePrice("");
      setOfferNotes("");
      qc.invalidateQueries({ queryKey: ["product-offers", id] });
    },
    onError: (e) => toast("error", e.message),
  });

  // Add Pricing Tier mutation
  const addTierMutation = useMutation({
    mutationFn: () =>
      api.post(`/offers/${selectedOfferForTier}/pricing-tiers`, [
        {
          min_quantity: parseInt(tierMinQty, 10),
          max_quantity: tierMaxQty ? parseInt(tierMaxQty, 10) : null,
          unit_price: parseFloat(tierPrice),
          currency,
        },
      ]),
    onSuccess: () => {
      toast("success", "Volume pricing tier added");
      setSelectedOfferForTier(null);
      setTierPrice("");
      qc.invalidateQueries({ queryKey: ["product-offers", id] });
    },
    onError: (e) => toast("error", e.message),
  });

  if (productQuery.isLoading) {
    return (
      <AppShell>
        <Loading label="Loading product..." />
      </AppShell>
    );
  }

  if (productQuery.isError || !productQuery.data) {
    return (
      <AppShell>
        <ErrorState error={productQuery.error} retry={() => productQuery.refetch()} />
      </AppShell>
    );
  }

  const product = productQuery.data;
  const offers = offersQuery.data ?? [];

  return (
    <AppShell title={product.title}>
      <div className="space-y-6">
        {/* Navigation & Action Bar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link href="/products" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                ← Back to Catalog
              </Link>
              <span>•</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  product.status === "published"
                    ? "bg-emerald-100 text-emerald-800"
                    : product.status === "draft"
                    ? "bg-slate-100 text-slate-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {product.status.toUpperCase()}
              </span>
              {product.brand && <Pill tone="blue">{product.brand}</Pill>}
              {product.model && <span className="text-xs text-slate-500">Model: {product.model}</span>}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{product.title}</h1>
            {product.short_title && <p className="text-sm font-medium text-slate-600">{product.short_title}</p>}
          </div>

          <div className="flex items-center gap-2">
            {product.listing_job_id && (
              <Link href={`/listings/${product.listing_job_id}`}>
                <Button variant="secondary" size="sm">
                  View AI Source Listing
                </Button>
              </Link>
            )}
            {product.status === "draft" && (
              <Button
                onClick={() => publishMutation.mutate()}
                loading={publishMutation.isPending}
              >
                Publish to Live Catalog
              </Button>
            )}
            {product.status === "published" && (
              <Button
                variant="secondary"
                onClick={() => archiveMutation.mutate()}
                loading={archiveMutation.isPending}
              >
                Archive Product
              </Button>
            )}
          </div>
        </div>

        {/* Product Details Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="space-y-6 lg:col-span-2">
            <Card title="Product Description & Highlights">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase text-slate-500">Full Description</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{product.description}</p>
                </div>
                {product.short_description && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase text-slate-500">Short Summary</h3>
                    <p className="mt-1 text-sm text-slate-600">{product.short_description}</p>
                  </div>
                )}
                {product.highlights && product.highlights.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase text-slate-500">Highlights</h3>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
                      {product.highlights.map((h, idx) => (
                        <li key={idx}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>

            {/* Verified Attributes Table */}
            <Card title="Verified Technical Attributes">
              {product.attributes.length === 0 ? (
                <p className="text-sm text-slate-500">No structured attributes recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                        <th className="py-2.5 pr-4">Attribute</th>
                        <th className="py-2.5 pr-4">Value</th>
                        <th className="py-2.5 pr-4">Source</th>
                        <th className="py-2.5">Evidence / Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {product.attributes.map((attr) => (
                        <tr key={attr.id} className="align-top">
                          <td className="py-2.5 pr-4 font-medium text-slate-900">
                            {attr.attribute_key.replace(/_/g, " ")}
                          </td>
                          <td className="py-2.5 pr-4 text-slate-700">
                            {typeof attr.value === "object"
                              ? JSON.stringify(attr.value)
                              : String(attr.value ?? "—")}
                          </td>
                          <td className="py-2.5 pr-4 text-xs">
                            <span className="capitalize text-slate-600">{attr.source}</span>
                            {attr.confidence !== null && (
                              <span className="ml-1 text-slate-400">({Math.round(attr.confidence * 100)}%)</span>
                            )}
                          </td>
                          <td className="py-2.5 text-xs">
                            {attr.verified || product.status === "published" || Boolean(product.listing_job_id) ? (
                              <Pill tone="green">Verified</Pill>
                            ) : (
                              <Pill tone="gray">Unverified</Pill>
                            )}
                            {attr.evidence && <div className="mt-0.5 text-slate-500">{attr.evidence}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Product Variants */}
            <Card
              title={`Variants (${product.variants.length})`}
              actions={
                <Button variant="secondary" size="sm" onClick={() => setShowAddVariant(true)}>
                  + Add Variant
                </Button>
              }
            >
              {showAddVariant && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-800">Add New Product Variant</h4>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field
                      id="v-sku"
                      label="SKU"
                      placeholder="e.g. PROD-BLK-XL"
                      value={variantSku}
                      onChange={(e) => setVariantSku(e.target.value)}
                      required
                    />
                    <Field
                      id="v-name"
                      label="Variant Name"
                      placeholder="e.g. XL - Midnight Black"
                      value={variantName}
                      onChange={(e) => setVariantName(e.target.value)}
                      required
                    />
                    <Field
                      id="v-barcode"
                      label="Barcode (Optional)"
                      placeholder="e.g. 012345678905"
                      value={variantBarcode}
                      onChange={(e) => setVariantBarcode(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowAddVariant(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={!variantSku || !variantName}
                      loading={addVariantMutation.isPending}
                      onClick={() =>
                        addVariantMutation.mutate({
                          sku: variantSku,
                          variant_name: variantName,
                          barcode: variantBarcode,
                        })
                      }
                    >
                      Save Variant
                    </Button>
                  </div>
                </div>
              )}

              {product.variants.length === 0 ? (
                <EmptyState
                  title="No variants defined"
                  hint="Create variants to offer different colors, sizes, or configurations."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                        <th className="py-2 pr-4">SKU</th>
                        <th className="py-2 pr-4">Variant Name</th>
                        <th className="py-2 pr-4">Barcode</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {product.variants.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2 pr-4 font-mono text-xs font-medium text-slate-800">{v.sku}</td>
                          <td className="py-2 pr-4 text-slate-800">{v.variant_name}</td>
                          <td className="py-2 pr-4 font-mono text-xs text-slate-500">{v.barcode || "—"}</td>
                          <td className="py-2">
                            <Pill tone={v.is_active ? "green" : "gray"}>
                              {v.is_active ? "Active" : "Inactive"}
                            </Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column: Commercial Offers & Pricing */}
          <div className="space-y-6 lg:col-span-1">
            <Card
              title="Commercial Offers"
              actions={
                <Button variant="secondary" size="sm" onClick={() => setShowAddOffer(true)}>
                  + New Offer
                </Button>
              }
            >
              {showAddOffer && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-slate-800">Add B2B / B2C Offer</h4>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Market Channel</label>
                    <select
                      value={offerType}
                      onChange={(e) => setOfferType(e.target.value as any)}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="both">Both B2B & B2C</option>
                      <option value="b2c">B2C Retail Only</option>
                      <option value="b2b">B2B Wholesale Only</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      id="o-retail"
                      label="Retail Price (₹ INR)"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={retailPrice}
                      onChange={(e) => setRetailPrice(e.target.value)}
                    />
                    <Field
                      id="o-wholesale"
                      label="Wholesale Price (₹ INR)"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={wholesalePrice}
                      onChange={(e) => setWholesalePrice(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      id="o-moq"
                      label="Min Order Qty (MOQ)"
                      type="number"
                      min="1"
                      value={moq}
                      onChange={(e) => setMoq(e.target.value)}
                    />
                    <Field
                      id="o-stock"
                      label="Stock Quantity"
                      type="number"
                      min="0"
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                    />
                  </div>

                  <Field
                    id="o-lead"
                    label="Lead Time (Days)"
                    type="number"
                    min="1"
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="secondary" size="sm" onClick={() => setShowAddOffer(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      loading={addOfferMutation.isPending}
                      onClick={() => addOfferMutation.mutate()}
                    >
                      Save Offer
                    </Button>
                  </div>
                </div>
              )}

              {offers.length === 0 ? (
                <EmptyState
                  title="No active commercial offers"
                  hint="Sellers define commercial terms (pricing, MOQ, lead times) independently from AI listings."
                />
              ) : (
                <div className="space-y-4">
                  {offers.map((offer) => (
                    <div key={offer.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Pill tone={offer.offer_type === "b2b" ? "blue" : offer.offer_type === "b2c" ? "green" : "gray"}>
                          {offer.offer_type.toUpperCase()}
                        </Pill>
                        <span className="text-xs text-slate-500 font-mono">
                          Stock: {offer.stock_quantity}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="block text-xs text-slate-400">Retail Price</span>
                          <span className="font-semibold text-slate-900">
                            {offer.retail_price ? `$${offer.retail_price}` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-400">Wholesale Price</span>
                          <span className="font-semibold text-slate-900">
                            {offer.wholesale_price ? `$${offer.wholesale_price}` : "—"}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-400">Min Order Qty (MOQ)</span>
                          <span className="font-medium text-slate-700">{offer.min_order_quantity} units</span>
                        </div>
                        <div>
                          <span className="block text-xs text-slate-400">Lead Time</span>
                          <span className="font-medium text-slate-700">{offer.lead_time_days} days</span>
                        </div>
                      </div>

                      {/* Tiered Pricing List */}
                      {offer.pricing_tiers && offer.pricing_tiers.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                            Volume Tiered Pricing
                          </span>
                          <div className="space-y-1 text-xs">
                            {offer.pricing_tiers.map((tier) => (
                              <div key={tier.id} className="flex justify-between text-slate-700">
                                <span>
                                  {tier.min_quantity}
                                  {tier.max_quantity ? ` - ${tier.max_quantity}` : "+"} units:
                                </span>
                                <span className="font-medium">${tier.unit_price} / unit</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Add Tier Action */}
                      <div className="pt-1">
                        {selectedOfferForTier === offer.id ? (
                          <div className="mt-2 space-y-2 rounded bg-slate-50 p-3">
                            <span className="text-xs font-semibold text-slate-700">Add Pricing Tier</span>
                            <div className="grid grid-cols-3 gap-1">
                              <Input
                                placeholder="Min"
                                type="number"
                                value={tierMinQty}
                                onChange={(e) => setTierMinQty(e.target.value)}
                              />
                              <Input
                                placeholder="Max"
                                type="number"
                                value={tierMaxQty}
                                onChange={(e) => setTierMaxQty(e.target.value)}
                              />
                              <Input
                                placeholder="Price $"
                                type="number"
                                step="0.01"
                                value={tierPrice}
                                onChange={(e) => setTierPrice(e.target.value)}
                              />
                            </div>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedOfferForTier(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                disabled={!tierMinQty || !tierPrice}
                                loading={addTierMutation.isPending}
                                onClick={() => addTierMutation.mutate()}
                              >
                                Add Tier
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedOfferForTier(offer.id)}
                            className="text-xs font-medium text-emerald-600 hover:underline"
                          >
                            + Add Volume Tier
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* SEO & Meta preview */}
            <Card title="SEO & Search Engine Data">
              <div className="space-y-3 text-xs">
                <div>
                  <span className="block font-semibold text-slate-500 uppercase">Meta Title</span>
                  <span className="text-slate-800">{product.seo_title || "—"}</span>
                </div>
                <div>
                  <span className="block font-semibold text-slate-500 uppercase">Meta Description</span>
                  <span className="text-slate-800">{product.seo_description || "—"}</span>
                </div>
                {product.tags && product.tags.length > 0 && (
                  <div>
                    <span className="block font-semibold text-slate-500 uppercase">Tags</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {product.tags.map((t, idx) => (
                        <span key={idx} className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

