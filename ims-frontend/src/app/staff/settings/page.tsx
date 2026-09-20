"use client";

import StaffDashboardLayout from "@/components/staff-pos/StaffDashboardLayout";
import SettingsWorkspace from "@/components/admin/settings/SettingsWorkspace";

export default function StaffSettingsPage() {
  return (
    <StaffDashboardLayout>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-50 p-6 md:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#232d46]">Staff Account</p>
            <h1 className="mt-2 text-2xl font-bold text-neutral-950 md:text-3xl">ACCOUNT SETTINGS</h1>
            <p className="mt-2 max-w-2xl text-sm text-neutral-600">Manage your account information and password.</p>
          </div>
        </section>
        <SettingsWorkspace />
      </div>
    </StaffDashboardLayout>
  );
}
