"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getDefaultLandingRoute } from "@/lib/routing/landing";
import { routeHref } from "@/lib/routing/routes";
import { logoutSession } from "@/lib/auth";

export default function NoAccess() {
  const auth = useAuthStore();
  const router = useRouter();
  const landing = getDefaultLandingRoute(auth);
  return <section className="m-6 rounded-xl border border-slate-200 bg-white p-8 text-[#232d46]" aria-labelledby="no-access-title">
    <h1 id="no-access-title" className="text-2xl font-bold">No Access</h1>
    <p className="mt-3">You do not have permission to view this page.</p>
    <p className="mt-2 text-sm text-slate-600">Contact an administrator if you need permission.</p>
    <div className="mt-6 flex flex-wrap gap-4">
      {landing !== "/no-access" && <Link href={landing} className="underline">Open your workspace</Link>}
      <Link href={routeHref("settings")} className="underline">Account settings</Link>
      <button type="button" className="underline" onClick={async () => { try { await logoutSession(); } finally { auth.logout(); router.replace("/login"); } }}>Sign out</button>
    </div>
  </section>;
}
