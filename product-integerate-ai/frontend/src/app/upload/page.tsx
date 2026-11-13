"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, ErrorState, useToast } from "@/components/ui";
import { api, API_BASE } from "@/lib/api";
import { assetUrl } from "@/lib/listing";
import type { CategoryNode, ImageOut } from "@/lib/types";

function flatten(nodes: CategoryNode[] = [], depth = 0): { id: string; label: string }[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.flatMap((n) => [
    { id: n.id, label: `${"— ".repeat(depth)}${n.name}` },
    ...flatten(n.children ?? [], depth + 1),
  ]);
}

export default function UploadPage() {
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageOut[]>([]);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("");
  const [hints, setHints] = useState("");
  const [error, setError] = useState<unknown>(null);
  const tree = useQuery({ queryKey: ["category-tree"], queryFn: () => api.get<CategoryNode[]>("/categories/tree") });

  async function upload(files: FileList | File[]) {
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const img = await api.post<ImageOut>("/images/upload", fd);
        setImages((cur) => (cur.some((i) => i.id === img.id) ? cur : [...cur, img]));
        if (img.duplicate) toast("success", `${file.name} was already uploaded; reusing it`);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<{ job_id: string }>("/ai/listings/generate", {
        image_ids: images.map((i) => i.id),
        category_id: category || null,
        seller_hints: hints,
      });
      router.push(`/listings/${r.job_id}`);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <AppShell title="AI Product Upload">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="1. Product images">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void upload(e.dataTransfer.files);
              }}
              className="rounded-lg border-2 border-dashed border-slate-300 p-8 text-center"
            >
              <p className="text-sm text-slate-600">Drag photos here or</p>
              <Button variant="secondary" className="mt-2" onClick={() => input.current?.click()} loading={busy}>
                Choose images
              </Button>
              <input
                ref={input}
                data-testid="file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                hidden
                onChange={(e) => e.target.files && void upload(e.target.files)}
              />
              <p className="mt-2 text-xs text-slate-500">PNG, JPEG or WebP · up to 10 images · at least 200×200 px</p>
            </div>
            {images.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {images.map((i) => (
                  <li key={i.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(i.thumbnail_url, API_BASE)} alt={i.original_filename} className="aspect-square w-full rounded-md object-cover border border-slate-200 shadow-sm" />
                    <p className="mt-1 truncate text-center text-[11px] font-medium text-slate-600" title={i.original_filename}>{i.original_filename}</p>
                    <button
                      aria-label={`Remove ${i.original_filename}`}
                      onClick={() => setImages((cur) => cur.filter((x) => x.id !== i.id))}
                      className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {error ? <ErrorState error={error} /> : null}
        </div>
        <Card title="2. Optional details">
          <label className="block text-sm font-medium text-slate-700" htmlFor="cat">
            Category (leave empty to let AI decide)
          </label>
          <select id="cat" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm">
            <option value="">Detect automatically</option>
            {flatten(tree.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="hints">
            Notes for the AI (treated as untrusted text)
          </label>
          <textarea id="hints" value={hints} onChange={(e) => setHints(e.target.value)} maxLength={2000} rows={4} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. sold as a set of two" />
          <Button className="mt-4 w-full" disabled={images.length === 0} loading={busy} onClick={generate}>
            Generate listing
          </Button>
          <p className="mt-2 text-xs text-slate-500">Nothing is published until you review and approve it.</p>
        </Card>
      </div>
    </AppShell>
  );
}
