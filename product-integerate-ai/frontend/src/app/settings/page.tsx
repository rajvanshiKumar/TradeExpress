"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { AppShell, useMe, useOrgs } from "@/components/AppShell";
import { Button, Card, EmptyState, Field, Input, Loading, Pill, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { orgSchema, type OrgValues } from "@/lib/schemas";
import { useSession } from "@/lib/store";
import type { ApiKey, Org, WebhookDelivery, WebhookEndpoint } from "@/lib/types";

interface Seller {
  display_name: string;
  business_model: string;
  country: string | null;
  verification_status: string;
}

interface ApiKeyCreatedResponse {
  key: ApiKey;
  raw_key: string;
  warning: string;
}

const ALL_SCOPES = [
  { id: "product:read", label: "Catalog Read (product:read)" },
  { id: "product:write", label: "Catalog Write (product:write)" },
  { id: "product:publish", label: "Catalog Publish (product:publish)" },
  { id: "offer:write", label: "Commercial Offers (offer:write)" },
  { id: "ai:run", label: "AI Pipeline Ingestion (ai:run)" },
];

const ALL_EVENTS = [
  { id: "listing.approved", label: "listing.approved (AI review completed)" },
  { id: "product.published", label: "product.published (Catalog publication)" },
];

export default function SettingsPage() {
  const me = useMe();
  const orgs = useOrgs();
  const qc = useQueryClient();
  const toast = useToast();
  const orgId = useSession((s) => s.orgId);

  const [activeTab, setActiveTab] = useState<"org" | "api_keys" | "webhooks">("org");

  // API Key Form State
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "product:read",
    "product:write",
    "product:publish",
    "ai:run",
  ]);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  // Webhook Form State
  const [showNewWebhookModal, setShowNewWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "listing.approved",
    "product.published",
  ]);
  const [inspectedWebhookId, setInspectedWebhookId] = useState<string | null>(null);

  // Org form
  const { register, handleSubmit, formState, reset } = useForm<OrgValues>({
    resolver: zodResolver(orgSchema),
    defaultValues: { org_type: "external_seller" },
  });

  const seller = useQuery({
    queryKey: ["seller", orgId],
    queryFn: () => api.get<Seller>("/sellers/profile"),
    enabled: !!orgId,
    retry: false,
  });

  // Queries for Developer tab
  const apiKeysQuery = useQuery({
    queryKey: ["api-keys", orgId],
    queryFn: () => api.get<ApiKey[]>("/developer/keys"),
    enabled: !!orgId && activeTab === "api_keys",
  });

  const webhooksQuery = useQuery({
    queryKey: ["webhooks", orgId],
    queryFn: () => api.get<WebhookEndpoint[]>("/developer/webhooks"),
    enabled: !!orgId && activeTab === "webhooks",
  });

  const deliveriesQuery = useQuery({
    queryKey: ["webhook-deliveries", inspectedWebhookId],
    queryFn: () => api.get<WebhookDelivery[]>(`/developer/webhooks/${inspectedWebhookId}/deliveries`),
    enabled: !!inspectedWebhookId,
  });

  // Mutations
  const createOrg = useMutation({
    mutationFn: (v: OrgValues) => api.post<Org>("/organizations", v),
    onSuccess: (o) => {
      useSession.getState().setOrg(o.id);
      void qc.invalidateQueries();
      toast("success", "Organization created");
      reset();
    },
    onError: (e) => toast("error", e.message),
  });

  const registerSeller = useMutation({
    mutationFn: (v: { display_name: string; business_model: string }) =>
      api.post("/sellers/register", v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["seller"] });
      toast("success", "Seller profile saved");
    },
    onError: (e) => toast("error", e.message),
  });

  const addMember = useMutation({
    mutationFn: (v: { email: string; role: string }) =>
      api.post(`/organizations/${orgId}/members`, v),
    onSuccess: () => toast("success", "Member added"),
    onError: (e) => toast("error", e.message),
  });

  // API Key Mutations
  const createApiKeyMutation = useMutation({
    mutationFn: () =>
      api.post<ApiKeyCreatedResponse>("/developer/keys", {
        name: keyName,
        scopes: selectedScopes,
      }),
    onSuccess: (res) => {
      setNewlyCreatedKey(res.raw_key);
      setKeyName("");
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] });
      toast("success", "API key generated successfully");
    },
    onError: (e) => toast("error", e.message),
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => api.delete(`/developer/keys/${keyId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-keys", orgId] });
      toast("success", "API key revoked");
    },
    onError: (e) => toast("error", e.message),
  });

  // Webhook Mutations
  const createWebhookMutation = useMutation({
    mutationFn: () =>
      api.post<WebhookEndpoint>("/developer/webhooks", {
        url: webhookUrl,
        events: selectedEvents,
      }),
    onSuccess: () => {
      setShowNewWebhookModal(false);
      setWebhookUrl("");
      qc.invalidateQueries({ queryKey: ["webhooks", orgId] });
      toast("success", "Webhook endpoint registered");
    },
    onError: (e) => toast("error", e.message),
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => api.delete(`/developer/webhooks/${webhookId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks", orgId] });
      if (inspectedWebhookId) setInspectedWebhookId(null);
      toast("success", "Webhook removed");
    },
    onError: (e) => toast("error", e.message),
  });

  const testWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => api.post(`/developer/webhooks/${webhookId}/test`),
    onSuccess: () => {
      toast("success", "Test event delivered to endpoint");
      qc.invalidateQueries({ queryKey: ["webhook-deliveries", inspectedWebhookId] });
    },
    onError: (e) => toast("error", e.message),
  });

  return (
    <AppShell title="Settings & Developer Integrations">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("org")}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "org"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Organization & Profile
          </button>
          <button
            onClick={() => setActiveTab("api_keys")}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "api_keys"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Developer API Keys
          </button>
          <button
            onClick={() => setActiveTab("webhooks")}
            className={`border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === "webhooks"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Webhooks & Events
          </button>
        </div>

        {/* Tab 1: Organization & Profile */}
        {activeTab === "org" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Account Profile">
              <dl className="space-y-1 text-sm">
                <div>
                  <dt className="inline text-slate-500">Name: </dt>
                  <dd className="inline font-medium text-slate-900">{me.data?.full_name}</dd>
                </div>
                <div>
                  <dt className="inline text-slate-500">Email: </dt>
                  <dd className="inline font-mono text-slate-700">{me.data?.email}</dd>
                </div>
                {me.data?.is_platform_admin && <Pill tone="blue">Platform administrator</Pill>}
              </dl>
            </Card>

            <Card title="Create Organization">
              <form className="space-y-3" noValidate onSubmit={handleSubmit((v) => createOrg.mutate(v))}>
                <Field
                  id="org-name"
                  label="Organization Name"
                  placeholder="e.g. Acme Global Logistics"
                  error={formState.errors.name?.message}
                  {...register("name")}
                />
                <label className="block text-sm font-medium text-slate-700" htmlFor="org-type">
                  Type
                </label>
                <select
                  id="org-type"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  {...register("org_type")}
                >
                  <option value="external_seller">External seller</option>
                  <option value="b2b_supplier">B2B supplier</option>
                  <option value="b2c_seller">B2C seller</option>
                </select>
                <Button type="submit" loading={createOrg.isPending}>
                  Create organization
                </Button>
              </form>
            </Card>

            {orgId && (
              <Card title="Marketplace Seller Profile">
                {seller.data ? (
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Store Name</dt>
                      <dd className="font-semibold text-slate-800">{seller.data.display_name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Model</dt>
                      <dd className="font-medium text-slate-700">{seller.data.business_model.toUpperCase()}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase text-slate-400">Verification</dt>
                      <dd className="mt-0.5">
                        <Pill tone={seller.data.verification_status === "verified" ? "green" : "gray"}>
                          {seller.data.verification_status}
                        </Pill>
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      registerSeller.mutate({
                        display_name: String(f.get("display_name")),
                        business_model: String(f.get("business_model")),
                      });
                    }}
                  >
                    <Field id="display_name" name="display_name" label="Store display name" required />
                    <label className="block text-sm font-medium text-slate-700">Business Model</label>
                    <select
                      name="business_model"
                      aria-label="Business model"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                      defaultValue="both"
                    >
                      <option value="b2b">B2B</option>
                      <option value="b2c">B2C</option>
                      <option value="both">Both B2B and B2C</option>
                    </select>
                    <Button type="submit" loading={registerSeller.isPending}>
                      Register as seller
                    </Button>
                  </form>
                )}
              </Card>
            )}

            {orgId && (
              <Card title="Invite Team Member">
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    addMember.mutate({
                      email: String(f.get("email")),
                      role: String(f.get("role")),
                    });
                    e.currentTarget.reset();
                  }}
                >
                  <Field id="m-email" name="email" type="email" label="Email of registered user" required />
                  <label className="block text-sm font-medium text-slate-700">Access Role</label>
                  <select
                    name="role"
                    aria-label="Role"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    defaultValue="editor"
                  >
                    <option value="admin">Admin (Full Control)</option>
                    <option value="editor">Editor (Create & Review)</option>
                    <option value="viewer">Viewer (Read-only)</option>
                  </select>
                  <Button type="submit" loading={addMember.isPending}>
                    Add member
                  </Button>
                </form>
              </Card>
            )}

            <Card title="Your Organizations" className="lg:col-span-2">
              <ul className="divide-y divide-slate-100 text-sm">
                {orgs.data?.items.map((o) => (
                  <li key={o.id} className="flex items-center justify-between py-3">
                    <div>
                      <span className="font-semibold text-slate-800">{o.name}</span>
                      <span className="ml-2 font-mono text-xs text-slate-400">({o.id})</span>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {o.org_type.replace(/_/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {/* Tab 2: Developer API Keys */}
        {activeTab === "api_keys" && (
          <div className="space-y-6">
            <Card
              title="API Authentication Keys"
              actions={
                <Button size="sm" onClick={() => setShowNewKeyModal(true)}>
                  + Generate New API Key
                </Button>
              }
            >
              <p className="mb-4 text-xs text-slate-500">
                Authenticate programmatic requests to TradeExpress Product Listing AI using the{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700">X-API-Key: tx_live_...</code>{" "}
                header. Keys inherit scoped tenant permissions.
              </p>

              {newlyCreatedKey && (
                <div className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">⚠️ Copy Your Secret API Key Now:</span>
                    <button
                      type="button"
                      onClick={() => setNewlyCreatedKey(null)}
                      className="text-xs text-emerald-700 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-emerald-800">
                    This key will never be displayed again. If lost, you must revoke it and generate a new one.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      readOnly
                      value={newlyCreatedKey}
                      className="w-full rounded border border-emerald-300 bg-white px-3 py-1.5 font-mono text-xs text-slate-800"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(newlyCreatedKey);
                        toast("success", "Key copied to clipboard");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}

              {apiKeysQuery.isLoading ? (
                <Loading label="Loading API keys..." />
              ) : !apiKeysQuery.data?.length ? (
                <EmptyState
                  title="No API keys generated yet"
                  hint="Create an API key to allow external marketplace servers or automation scripts to access your catalog."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                        <th className="py-2.5 pr-4">Name</th>
                        <th className="py-2.5 pr-4">Key Prefix</th>
                        <th className="py-2.5 pr-4">Granted Scopes</th>
                        <th className="py-2.5 pr-4">Last Used</th>
                        <th className="py-2.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {apiKeysQuery.data.map((k) => (
                        <tr key={k.id}>
                          <td className="py-2.5 pr-4 font-medium text-slate-900">{k.name}</td>
                          <td className="py-2.5 pr-4 font-mono text-xs text-slate-600">{k.prefix}…</td>
                          <td className="py-2.5 pr-4">
                            <div className="flex flex-wrap gap-1">
                              {k.scopes.map((s) => (
                                <span
                                  key={s}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-slate-700"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-slate-500">
                            {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                          </td>
                          <td className="py-2.5 text-right">
                            <Button
                              variant="danger"
                              size="sm"
                              className="px-2 py-1 text-xs"
                              loading={revokeApiKeyMutation.isPending}
                              onClick={() => {
                                if (confirm(`Revoke API key "${k.name}"? This cannot be undone.`)) {
                                  revokeApiKeyMutation.mutate(k.id);
                                }
                              }}
                            >
                              Revoke
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Modal for creating API Key */}
            {showNewKeyModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="text-lg font-bold text-slate-900">Generate Scoped API Key</h3>
                    <button
                      type="button"
                      onClick={() => setShowNewKeyModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-semibold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3">
                    <Field
                      id="key-name"
                      label="Key Identifier / Description"
                      placeholder="e.g. TradeExpress Live Marketplace Connector"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      required
                    />

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                        Select Allowed Scopes
                      </label>
                      <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
                        {ALL_SCOPES.map((sc) => (
                          <label key={sc.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedScopes.includes(sc.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedScopes([...selectedScopes, sc.id]);
                                } else {
                                  setSelectedScopes(selectedScopes.filter((s) => s !== sc.id));
                                }
                              }}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>{sc.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="secondary" onClick={() => setShowNewKeyModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!keyName.trim() || selectedScopes.length === 0}
                      loading={createApiKeyMutation.isPending}
                      onClick={async () => {
                        await createApiKeyMutation.mutateAsync();
                        setShowNewKeyModal(false);
                      }}
                    >
                      Create API Key
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Webhooks & Subscriptions */}
        {activeTab === "webhooks" && (
          <div className="space-y-6">
            <Card
              title="Real-Time Webhook Endpoints"
              actions={
                <Button size="sm" onClick={() => setShowNewWebhookModal(true)}>
                  + Register Webhook
                </Button>
              }
            >
              <p className="mb-4 text-xs text-slate-500">
                Receive HMAC-SHA256 signed event notifications whenever product listings are approved or catalog items
                are published. Payloads are signed with your unique secret in the{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-700">
                  X-TradeExpress-Signature
                </code>{" "}
                header.
              </p>

              {webhooksQuery.isLoading ? (
                <Loading label="Loading webhooks..." />
              ) : !webhooksQuery.data?.length ? (
                <EmptyState
                  title="No webhook endpoints configured"
                  hint="Register an HTTPS callback URL to sync approved listings with your external e-commerce store."
                />
              ) : (
                <div className="space-y-4">
                  {webhooksQuery.data.map((wh) => (
                    <div key={wh.id} className="rounded-lg border border-slate-200 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="font-mono text-sm font-semibold text-slate-900">{wh.url}</span>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>Secret: <code className="font-mono">{wh.secret}</code></span>
                            <span>•</span>
                            <span>Created: {new Date(wh.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={testWebhookMutation.isPending}
                            onClick={() => testWebhookMutation.mutate(wh.id)}
                          >
                            Send Test Ping
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() =>
                              setInspectedWebhookId(inspectedWebhookId === wh.id ? null : wh.id)
                            }
                          >
                            {inspectedWebhookId === wh.id ? "Hide Logs" : "View Deliveries"}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="px-2"
                            onClick={() => {
                              if (confirm("Delete this webhook endpoint?")) {
                                deleteWebhookMutation.mutate(wh.id);
                              }
                            }}
                          >
                            ✕
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1 text-xs">
                        <span className="text-slate-400">Events:</span>
                        {wh.events.map((e) => (
                          <span key={e} className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-700">
                            {e}
                          </span>
                        ))}
                      </div>

                      {/* Deliveries drawer */}
                      {inspectedWebhookId === wh.id && (
                        <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                          <h4 className="text-xs font-semibold uppercase text-slate-500">Recent Deliveries</h4>
                          {deliveriesQuery.isLoading ? (
                            <Loading label="Loading deliveries..." />
                          ) : !deliveriesQuery.data?.length ? (
                            <p className="text-xs text-slate-400">No deliveries recorded yet. Try sending a test ping.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {deliveriesQuery.data.map((d) => (
                                <div
                                  key={d.id}
                                  className="flex items-center justify-between rounded bg-slate-50 px-3 py-1.5 text-xs"
                                >
                                  <div className="flex items-center gap-2 font-mono">
                                    <Pill tone={d.success ? "green" : "red"}>
                                      {d.status_code ?? "ERR"}
                                    </Pill>
                                    <span className="font-semibold text-slate-800">{d.event_type}</span>
                                  </div>
                                  <span className="text-slate-400">
                                    {new Date(d.created_at).toLocaleTimeString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Modal for creating Webhook */}
            {showNewWebhookModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
                  <div className="flex items-center justify-between border-b pb-3">
                    <h3 className="text-lg font-bold text-slate-900">Register Webhook Endpoint</h3>
                    <button
                      type="button"
                      onClick={() => setShowNewWebhookModal(false)}
                      className="text-slate-400 hover:text-slate-600 font-semibold"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3">
                    <Field
                      id="wh-url"
                      label="HTTPS Webhook URL"
                      placeholder="https://tradeexpress-1.onrender.com/api/v1/webhooks/tx-ai"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      required
                    />

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                        Subscribed Event Topics
                      </label>
                      <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
                        {ALL_EVENTS.map((ev) => (
                          <label key={ev.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedEvents.includes(ev.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedEvents([...selectedEvents, ev.id]);
                                } else {
                                  setSelectedEvents(selectedEvents.filter((evId) => evId !== ev.id));
                                }
                              }}
                              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>{ev.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="secondary" onClick={() => setShowNewWebhookModal(false)}>
                      Cancel
                    </Button>
                    <Button
                      disabled={!webhookUrl.startsWith("http") || selectedEvents.length === 0}
                      loading={createWebhookMutation.isPending}
                      onClick={() => createWebhookMutation.mutate()}
                    >
                      Register Webhook
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
