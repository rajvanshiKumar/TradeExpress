"use client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui";
import { API_BASE } from "@/lib/api";

const GROUPS: [string, [string, string, string][]][] = [
  ["Auth", [["POST", "/auth/register", "Create account"], ["POST", "/auth/login", "Access + refresh tokens"], ["POST", "/auth/refresh", "Rotate refresh token"], ["POST", "/auth/logout", "Revoke session"], ["GET", "/auth/me", "Current user"]]],
  ["Images", [["POST", "/images/upload", "Multipart upload with validation"], ["GET", "/images/{id}", "Metadata + signed URLs"], ["DELETE", "/images/{id}", "Delete image"]]],
  ["AI listings", [["POST", "/ai/listings/analyze", "Analysis only (202 + job id)"], ["POST", "/ai/listings/generate", "Full pipeline (202 + job id)"], ["GET", "/ai/listings/{job_id}/status", "Poll progress"], ["GET", "/ai/listings/{job_id}/result", "Structured result"], ["POST", "/ai/listings/{job_id}/regenerate", "Regenerate one field"], ["POST", "/ai/listings/{job_id}/approve", "Explicit seller approval"], ["POST", "/ai/listings/{job_id}/reject", "Reject AI output"], ["POST", "/ai/listings/{job_id}/feedback", "Rate output"]]],
  ["Bulk & translation", [["POST", "/ai/bulk-upload", "Images or ZIP"], ["GET", "/ai/bulk-upload/{id}", "Batch progress"], ["POST", "/ai/bulk-upload/{id}/retry", "Retry failed"], ["GET", "/ai/bulk-upload/{id}/export", "CSV export"], ["POST", "/ai/translate", "Translate a listing"], ["GET", "/languages", "Supported languages"]]],
  ["Categories", [["GET", "/categories/tree", "Hierarchy"], ["GET", "/categories/{id}/attributes", "Dynamic schema (inherited)"], ["POST", "/categories/{id}/validate", "Validate values"]]],
];

export default function DocsPage() {
  return (
    <AppShell title="API Documentation">
      <div className="space-y-6">
        <Card title="Interactive reference">
          <p className="text-sm text-slate-600">
            The backend publishes an OpenAPI schema. Open the{" "}
            <a className="text-emerald-700 underline" href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">interactive docs</a> (development/staging) or fetch{" "}
            <a className="text-emerald-700 underline" href={`${API_BASE}/openapi.json`} target="_blank" rel="noreferrer">openapi.json</a>.
            All endpoints live under <code>/api/v1</code>; send <code>Authorization: Bearer …</code> and <code>X-Organization-Id</code>.
          </p>
        </Card>
        {GROUPS.map(([name, rows]) => (
          <Card key={name} title={name}>
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-slate-100">
                {rows.map(([m, p, d]) => (
                  <tr key={m + p}>
                    <td className="w-16 py-1.5 font-mono text-xs font-semibold text-emerald-700">{m}</td>
                    <td className="font-mono text-xs">/api/v1{p}</td>
                    <td className="text-slate-500">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
