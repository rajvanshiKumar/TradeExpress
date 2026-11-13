"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState, ErrorState, Loading, StatusPill } from "@/components/ui";
import { api, API_BASE } from "@/lib/api";
import { assetUrl, isActive } from "@/lib/listing";
import { useSession } from "@/lib/store";
import type { JobListItem, Page } from "@/lib/types";

const FILTERS = [
  ["", "All"],
  ["awaiting_review", "Needs review"],
  ["approved", "Approved (catalog)"],
  ["running", "Processing"],
  ["failed", "Failed"],
  ["rejected", "Rejected"],
] as const;

export default function ListingsPage() {
  const orgId = useSession((s) => s.orgId);
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const q = useQuery({
    queryKey: ["jobs", orgId, status, offset],
    queryFn: () => api.get<Page<JobListItem>>(`/ai/listings?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ""}`),
    enabled: !!orgId,
    refetchInterval: (query) => (query.state.data?.items.some((j) => isActive(j.status)) ? 3000 : false),
  });
  return (
    <AppShell title="Listings & Jobs">
      <Card
        title="Product catalog and job monitoring"
        actions={
          <div role="tablist" className="flex flex-wrap gap-1">
            {FILTERS.map(([v, label]) => (
              <button
                key={v}
                role="tab"
                aria-selected={status === v}
                onClick={() => {
                  setStatus(v);
                  setOffset(0);
                }}
                className={`rounded-full px-3 py-1 text-xs ${status === v ? "bg-[#0b1f3a] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {q.isPending && !q.isError ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState error={q.error} retry={() => q.refetch()} />
        ) : q.data!.items.length === 0 ? (
          <EmptyState title="Nothing here yet" hint="Listings you generate will appear here." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Listing</th>
                    <th>Category</th>
                    <th>Stage</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {q.data!.items.map((j) => (
                    <tr key={j.job_id} className="hover:bg-slate-50">
                      <td className="py-2">
                        <Link href={`/listings/${j.job_id}`} className="flex items-center gap-3">
                          {j.thumbnail_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={assetUrl(j.thumbnail_url, API_BASE)} alt="" className="h-10 w-10 rounded object-cover" />
                          )}
                          <span className="max-w-xs truncate font-medium">{j.title ?? "Untitled listing"}</span>
                        </Link>
                      </td>
                      <td>{j.category_name ?? "–"}</td>
                      <td className="text-slate-500">
                        {j.stage} · {j.progress}%
                      </td>
                      <td>
                        <StatusPill status={j.status} />
                        {j.error && <div className="max-w-[16rem] truncate text-xs text-red-600" title={j.error}>{j.error}</div>}
                      </td>
                      <td className="text-slate-500">{new Date(j.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                {offset + 1}–{Math.min(offset + limit, q.data!.total)} of {q.data!.total}
              </span>
              <span className="space-x-2">
                <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="rounded border px-2 py-1 disabled:opacity-40">
                  Previous
                </button>
                <button disabled={offset + limit >= q.data!.total} onClick={() => setOffset(offset + limit)} className="rounded border px-2 py-1 disabled:opacity-40">
                  Next
                </button>
              </span>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
