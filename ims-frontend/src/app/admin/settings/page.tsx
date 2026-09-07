"use client";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import SettingsWorkspace from "@/components/admin/settings/SettingsWorkspace";

export default function SettingsPage() {
  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-sm">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(244,90,31,0.18),transparent_34%),linear-gradient(135deg,#ffffff_0%,#fff7ed_54%,#f8f3ec_100%)] p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f45a1f]">
              Administrator
            </p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 md:text-3xl">
              SETTINGS
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">
              Manage your account information and security.
            </p>
          </div>
        </section>

        <SettingsWorkspace />
      </div>
    </AdminDashboardLayout>
  );
}
