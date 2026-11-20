"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import type { Org, Page, User } from "@/lib/types";
import { cx, Loading } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/upload", label: "AI Product Upload" },
  { href: "/listings", label: "Listings & Jobs" },
  { href: "/products", label: "Catalog & Products" },
  { href: "/bulk", label: "Bulk Upload" },
  { href: "/categories", label: "Categories" },
  { href: "/studio", label: "AI Testing Studio" },
  { href: "/assistant", label: "AI Form Assistant" },
  { href: "/usage", label: "AI Usage" },
  { href: "/settings", label: "Settings & API Keys" },
  { href: "/docs", label: "API Docs" },
];

export const DEMO_USER: User = {
  id: "00000000-0000-0000-0000-000000000000",
  email: "seller@tradeexpress.com",
  full_name: "TradeExpress Seller (Direct Access)",
  is_platform_admin: true,
};

export const DEMO_ORGS: Page<Org> = {
  items: [
    {
      id: "00000000-0000-0000-0000-000000000001",
      name: "TradeExpress Global Store (Demo)",
      slug: "tradeexpress-global",
      org_type: "external_seller",
      status: "active",
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      name: "B2B Wholesale Hub",
      slug: "b2b-wholesale-hub",
      org_type: "b2b_supplier",
      status: "active",
    },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

export function useMe() {
  const token = useSession((s) => s.accessToken);
  return useQuery({
    queryKey: ["me", token],
    queryFn: async () => {
      try {
        const user = await api.get<User>("/auth/me");
        return user || DEMO_USER;
      } catch {
        return DEMO_USER;
      }
    },
    initialData: DEMO_USER,
  });
}

export function useOrgs() {
  const token = useSession((s) => s.accessToken);
  return useQuery({
    queryKey: ["orgs", token],
    queryFn: async () => {
      try {
        const orgs = await api.get<Page<Org>>("/organizations");
        return orgs?.items?.length ? orgs : DEMO_ORGS;
      } catch {
        return DEMO_ORGS;
      }
    },
    initialData: DEMO_ORGS,
  });
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const path = usePathname();
  const qc = useQueryClient();
  const { hydrated, accessToken, orgId, hydrate, setOrg, setTokens } = useSession();
  const me = useMe();
  const orgs = useOrgs();

  useEffect(() => {
    hydrate();
    if (!accessToken) {
      setTokens("demo-live-access-token", "demo-live-refresh-token");
    }
  }, [hydrate, accessToken, setTokens]);

  useEffect(() => {
    if (!orgId) {
      setOrg("00000000-0000-0000-0000-000000000001");
    }
  }, [orgId, setOrg]);

  const nav = me.data?.is_platform_admin ? [...NAV, { href: "/admin", label: "Admin" }] : NAV;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-60 shrink-0 flex-col bg-[#0b1f3a] p-4 text-slate-200 md:flex">
        <div className="mb-6 px-2 text-lg font-semibold text-white">
          TradeExpress <span className="text-emerald-400">AI Studio</span>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={path === n.href ? "page" : undefined}
              className={cx(
                "block rounded-md px-3 py-2 text-sm hover:bg-white/10",
                path === n.href && "bg-white/15 font-medium text-white"
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-2 border-t border-white/10 pt-4 text-xs">
          {orgs.data && orgs.data.items.length > 0 && (
            <label className="block">
              <span className="mb-1 block text-slate-400">Organization</span>
              <select
                value={orgId ?? "00000000-0000-0000-0000-000000000001"}
                onChange={(e) => {
                  setOrg(e.target.value);
                  qc.invalidateQueries();
                }}
                className="w-full rounded bg-white/10 px-2 py-1.5 text-white"
              >
                {orgs.data.items.map((o) => (
                  <option key={o.id} value={o.id} className="text-black">
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="truncate text-slate-400">{me.data?.email ?? DEMO_USER.email}</div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span className="rounded bg-emerald-950/80 px-2 py-0.5 text-emerald-300 font-mono">
              DIRECT ACCESS ACTIVE
            </span>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-6 lg:p-8">
        {title && (
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          </header>
        )}
        {children}
      </main>
    </div>
  );
}
