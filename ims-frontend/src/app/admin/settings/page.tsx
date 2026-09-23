"use client";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import SettingsWorkspace from "@/components/admin/settings/SettingsWorkspace";

export default function SettingsPage() {
  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-[#232d46]/10 bg-white shadow-sm">
          <div className="bg-[#f5f5f5] p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#232d46]">
              Account
            </p>
            <h1 className="mt-2 text-2xl font-bold text-[#232d46] md:text-3xl">
              SETTINGS
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#232d46]/75">
              Manage your account information and security.
            </p>
          </div>
        </section>

        <SettingsWorkspace />
      </div>
    </AdminDashboardLayout>
  );
}
