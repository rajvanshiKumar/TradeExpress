"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState, ErrorState, Loading, StatusPill } from "@/components/ui";
import { api, API_BASE } from "@/lib/api";
import { assetUrl } from "@/lib/listing";
import { useSession } from "@/lib/store";
import type { JobListItem, Page } from "@/lib/types";

interface Usage {
  jobs: Record<string, number>;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number | null;
  approval_rate: number | null;
  attribute_correction_rate: number | null;
}

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[#0b1f3a]">{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const orgId = useSession((s) => s.orgId);
  const usage = useQuery({ queryKey: ["usage", orgId], queryFn: () => api.get<Usage>("/ai/usage"), enabled: !!orgId });
  const jobs = useQuery({
    queryKey: ["jobs", orgId, "recent"],
    queryFn: () => api.get<Page<JobListItem>>("/ai/listings?limit=6"),
    enabled: !!orgId,
  });
  return (
    <AppShell title="Dashboard">
      {!orgId || usage.isLoading ? (
        <Loading />
      ) : usage.isError ? (
        <ErrorState error={usage.error} retry={() => usage.refetch()} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Listings generated" value={usage.data!.jobs.total ?? 0} />
            <Stat label="Awaiting review" value={usage.data!.jobs.awaiting_review ?? 0} />
            <Stat label="Approved" value={usage.data!.jobs.approved ?? 0} hint={`Approval rate ${pct(usage.data!.approval_rate)}`} />
            <Stat label="Seller correction rate" value={pct(usage.data!.attribute_correction_rate)} hint="Attributes edited before approval" />
          </div>
          <Card
            title="Recent listings"
            actions={
              <Link href="/upload" className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">
                New listing
              </Link>
            }
          >
            {jobs.isLoading ? (
              <Loading />
            ) : jobs.data && jobs.data.items.length > 0 ? (
              <ul className="divide-y divide-slate-100">
                {jobs.data.items.map((j, idx) => (
                  <li key={j.job_id || idx}>
                    <Link href={`/listings/${j.job_id}`} className="flex items-center gap-3 py-3 hover:bg-slate-50">
                      {j.thumbnail_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={assetUrl(j.thumbnail_url, API_BASE)} alt="" className="h-12 w-12 rounded object-cover" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{j.title ?? "Untitled listing"}</div>
                        <div className="text-xs text-slate-500">{j.category_name ?? "Category not set"}</div>
                      </div>
                      <StatusPill status={j.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No listings yet" hint="Upload a product photo and let the AI draft the listing." />
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
