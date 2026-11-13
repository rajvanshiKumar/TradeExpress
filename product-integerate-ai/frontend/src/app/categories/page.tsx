"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useMe } from "@/components/AppShell";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Field, Loading, Pill, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import type { CategoryAttribute, CategoryNode } from "@/lib/types";

function Tree({ nodes = [], selected, onSelect }: { nodes: CategoryNode[]; selected: string | null; onSelect: (n: CategoryNode) => void }) {
  if (!Array.isArray(nodes)) return null;
  return (
    <ul className="space-y-0.5">
      {nodes.map((n) => (
        <li key={n.id}>
          <button onClick={() => onSelect(n)} className={`w-full rounded px-2 py-1 text-left text-sm hover:bg-slate-100 ${selected === n.id ? "bg-emerald-50 font-medium text-emerald-800" : ""}`}>
            {n.name}
          </button>
          {n.children && n.children.length > 0 && <div className="ml-4 border-l border-slate-200 pl-2"><Tree nodes={n.children} selected={selected} onSelect={onSelect} /></div>}
        </li>
      ))}
    </ul>
  );
}

export default function CategoriesPage() {
  const me = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [sel, setSel] = useState<CategoryNode | null>(null);
  const [newName, setNewName] = useState("");
  const [attrKey, setAttrKey] = useState("");
  const [attrType, setAttrType] = useState("string");
  const tree = useQuery({ queryKey: ["category-tree"], queryFn: () => api.get<CategoryNode[]>("/categories/tree") });
  const attrs = useQuery({ queryKey: ["cat-attrs", sel?.id], queryFn: () => api.get<CategoryAttribute[]>(`/categories/${sel!.id}/attributes`), enabled: !!sel });
  const isAdmin = me.data?.is_platform_admin;

  const create = useMutation({
    mutationFn: () => api.post("/admin/categories", { name: newName, slug: newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), parent_id: sel?.id ?? null }),
    onSuccess: () => { toast("success", "Category created"); setNewName(""); void qc.invalidateQueries({ queryKey: ["category-tree"] }); },
    onError: (e) => toast("error", e.message),
  });
  const addAttr = useMutation({
    mutationFn: () => api.post(`/admin/categories/${sel!.id}/attributes`, {
      key: attrKey, label: attrKey.replace(/_/g, " "), data_type: attrType,
      ...(attrType === "enum" || attrType === "multi_select" ? { options: [{ value: "option-1", label: "Option 1" }] } : {}),
    }),
    onSuccess: () => { toast("success", "Attribute added (schema version bumped)"); setAttrKey(""); void qc.invalidateQueries({ queryKey: ["cat-attrs", sel?.id] }); },
    onError: (e) => toast("error", e.message),
  });

  return (
    <AppShell title="Categories">
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Category tree">
          {tree.isLoading ? <Loading /> : <Tree nodes={tree.data ?? []} selected={sel?.id ?? null} onSelect={setSel} />}
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card title={sel ? `Attributes · ${sel.name}` : "Select a category"}>
            {sel && (attrs.isLoading ? <Loading /> : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500"><tr><th>Key</th><th>Type</th><th>Flags</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {attrs.data?.map((a) => (
                    <tr key={a.key}>
                      <td className="py-1.5">{a.label} <span className="text-xs text-slate-400">{a.key}</span></td>
                      <td>{a.data_type}{a.unit ? ` (${a.unit})` : ""}</td>
                      <td className="space-x-1">{a.required && <Pill tone="red">required</Pill>}{a.ocr_extractable && <Pill tone="blue">OCR</Pill>}{a.options.length > 0 && <Pill>{a.options.length} options</Pill>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
            <p className="mt-3 text-xs text-slate-500">Attributes are inherited from parent categories and stored in the database, not in code.</p>
          </Card>
          {isAdmin && (
            <Card title="Administrator tools">
              <div className="flex flex-wrap items-end gap-2">
                <Field id="new-cat" label={sel ? `New child of “${sel.name}”` : "New top-level category"} value={newName} onChange={(e) => setNewName(e.target.value)} />
                <Button onClick={() => create.mutate()} disabled={!newName} loading={create.isPending}>Add category</Button>
              </div>
              {sel && (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <Field id="attr-key" label="New attribute key" value={attrKey} onChange={(e) => setAttrKey(e.target.value)} placeholder="e.g. screen_size" />
                  <select aria-label="Data type" value={attrType} onChange={(e) => setAttrType(e.target.value)} className="rounded-md border border-slate-300 px-2 py-2 text-sm">
                    {["string", "integer", "decimal", "boolean", "enum", "multi_select", "date", "measurement", "dimension", "weight", "currency", "url", "object", "array"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <Button onClick={() => addAttr.mutate()} disabled={!/^[a-z][a-z0-9_]*$/.test(attrKey)} loading={addAttr.isPending}>Add attribute</Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
