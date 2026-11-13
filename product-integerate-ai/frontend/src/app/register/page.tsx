"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-slate-100">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm space-y-5 text-center">
        <h1 className="text-2xl font-bold text-[#0b1f3a]">Create Account</h1>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm space-y-1">
          <p className="font-semibold text-base">Direct Testing Mode Active</p>
          <p className="text-xs text-emerald-700">
            Account registration is not required. You can test all features directly.
          </p>
        </div>
        <Button className="w-full py-2.5 text-base" onClick={() => router.push("/")}>
          Enter Dashboard & Catalog →
        </Button>
        <p className="text-xs text-slate-500">Redirecting automatically…</p>
      </div>
    </div>
  );
}
