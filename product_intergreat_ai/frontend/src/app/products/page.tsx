"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Input, Loading } from "@/components/ui";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Page, Product } from "@/lib/types";

export default function ProductsPage() {
  const orgId = useSession((s) => s.orgId);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["products", orgId, search, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      return api.get<Page<Product>>(`/products?${params.toString()}`);
    },
    enabled: !!orgId,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/publish`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/products/${id}/archive`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  return (
    <AppShell title="Product Catalog">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Official Product Catalog</h1>
            <p className="text-sm text-slate-600">
              Master catalog of verified and seller-approved products with B2B/B2C offers.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/upload">
              <Button>+ AI New Listing</Button>
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              placeholder="Search by title, brand, or model…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase text-slate-500">Status:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-navy-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </Card>

        {isLoading ? (
          <Loading label="Loading products…" />
        ) : !data?.items.length ? (
          <Card className="p-12 text-center">
            <p className="text-slate-600">No products found in this organization catalog.</p>
            <p className="mt-1 text-xs text-slate-400">
              Approved AI listings can be published directly to this master catalog.
            </p>
            <div className="mt-4">
              <Link href="/upload">
                <Button>Create Listing with AI</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {data.items.map((prod) => (
              <Card key={prod.id} className="p-5 transition-shadow hover:shadow-md">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          prod.status === "published"
                            ? "bg-emerald-100 text-emerald-800"
                            : prod.status === "draft"
                            ? "bg-slate-100 text-slate-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {prod.status.toUpperCase()}
                      </span>
                      {prod.brand && (
                        <span className="rounded bg-navy-50 px-2 py-0.5 text-xs font-semibold text-[#0b1f3a]">
                          {prod.brand}
                        </span>
                      )}
                      {prod.model && (
                        <span className="text-xs text-slate-500">Model: {prod.model}</span>
                      )}
                    </div>
                    <Link
                      href={`/products/${prod.id}`}
                      className="text-lg font-semibold text-[#0b1f3a] hover:underline"
                    >
                      {prod.title}
                    </Link>
                    <p className="line-clamp-2 text-sm text-slate-600">{prod.description}</p>
                    <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-500">
                      <span>{prod.variants.length} variant(s)</span>
                      <span>•</span>
                      <span>{prod.attributes.length} verified attribute(s)</span>
                      {prod.offers && prod.offers.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-emerald-600">
                            {prod.offers[0].offer_type.toUpperCase()} Offer (MOQ:{" "}
                            {prod.offers[0].min_order_quantity}
                            {prod.offers[0].retail_price
                              ? `, $${prod.offers[0].retail_price}`
                              : ""}
                            )
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Link href={`/products/${prod.id}`}>
                      <Button variant="secondary" size="sm">
                        Manage Offers
                      </Button>
                    </Link>
                    {prod.status === "draft" && (
                      <Button
                        size="sm"
                        onClick={() => publishMutation.mutate(prod.id)}
                        disabled={publishMutation.isPending}
                      >
                        Publish
                      </Button>
                    )}
                    {prod.status === "published" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => archiveMutation.mutate(prod.id)}
                        disabled={archiveMutation.isPending}
                      >
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

