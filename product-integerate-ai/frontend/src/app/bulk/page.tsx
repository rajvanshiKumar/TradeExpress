"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorState, Loading, StatusPill, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import type { BulkSummary } from "@/lib/types";

export default function BulkPage() {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [bulkId, setBulkId] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["bulk", bulkId],
    queryFn: () => api.get<BulkSummary>(`/ai/bulk-upload/${bulkId}`),
    enabled: !!bulkId,
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 2500 : false),
  });

  const start = useMutation({
    mutationFn: (files: File[]) => {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      return api.post<{ bulk_id: string; total: number }>("/ai/bulk-upload", fd);
    },
    onSuccess: (r) => { setBulkId(r.bulk_id); toast("success", `Batch of ${r.total} started`); },
    onError: (e) => toast("error", e.message),
  });
  const retry = useMutation({
    mutationFn: () => api.post<{ retried: number }>(`/ai/bulk-upload/${bulkId}/retry`),
    onSuccess: (r) => { toast("success", `Retrying ${r.retried} failed item(s)`); void status.refetch(); },
    onError: (e) => toast("error", e.message),
  });
  const approveAll = useMutation({
    mutationFn: () => api.post<{ approved: number; skipped: { filename: string; errors: Record<string, string[]> | null }[] }>(`/ai/bulk-upload/${bulkId}/approve`),
    onSuccess: (r) => {
      toast(r.skipped.length ? "error" : "success", `${r.approved} approved, ${r.skipped.length} skipped (need your attention)`);
      void status.refetch();
    },
    onError: (e) => toast("error", e.message),
  });

  async function exportCsv() {
    const text = await api.text(`/ai/bulk-upload/${bulkId}/export`);
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `bulk-${bulkId}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  const s = status.data;
  return (
    <AppShell title="Bulk Upload">
      <div className="space-y-6">
        <Card title="Upload a batch">
          <p className="mb-3 text-sm text-slate-600">
            Select many product photos or one ZIP of images. Each image becomes its own listing job, processed in the background.
          </p>
          <Button onClick={() => input.current?.click()} loading={start.isPending}>Choose images or ZIP</Button>
          <input ref={input} data-testid="bulk-input" type="file" multiple hidden accept="image/png,image/jpeg,image/webp,.zip,application/zip"
            onChange={(e) => e.target.files?.length && start.mutate(Array.from(e.target.files))} />
        </Card>
        {bulkId && (
          <Card
            title={s ? `Batch · ${s.total} item(s) · ${s.status}` : "Batch"}
            actions={
              s && (
                <>
                  <Button variant="secondary" onClick={() => retry.mutate()} disabled={!s.counts.failed} loading={retry.isPending}>Retry failed</Button>
                  <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
                  <Button onClick={() => approveAll.mutate()} disabled={!s.counts.awaiting_review} loading={approveAll.isPending}>Approve all ready</Button>
                </>
              )
            }
          >
            {status.isLoading ? <Loading /> : status.isError ? <ErrorState error={status.error} /> : (
              <>
                <div className="mb-3 flex flex-wrap gap-2 text-xs">
                  {Object.entries(s!.counts).map(([k, v]) => <span key={k} className="flex items-center gap-1"><StatusPill status={k} /> {v}</span>)}
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500"><tr><th>File</th><th>Status</th><th>Progress</th><th>Detail</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {s!.items.map((i, n) => (
                      <tr key={`${i.filename}-${n}`}>
                        <td className="py-2">{i.job_id ? <Link className="text-emerald-700 underline" href={`/listings/${i.job_id}`}>{i.filename}</Link> : i.filename}</td>
                        <td><StatusPill status={i.status} /></td>
                        <td className="tabular-nums">{i.progress}%</td>
                        <td className="max-w-xs truncate text-xs text-red-600" title={i.error ?? ""}>{i.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
