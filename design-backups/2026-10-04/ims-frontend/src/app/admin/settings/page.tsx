"use client";

import readable from "@/components/admin/ReadableWorkspace.module.css";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import SettingsWorkspace from "@/components/admin/settings/SettingsWorkspace";
import MyAccountHeader from "@/components/admin/settings/MyAccountHeader";

export default function SettingsPage() {
  return (
    <AdminDashboardLayout showHeader={false}>
      <div className={`${readable.readable} space-y-6`}>
        <MyAccountHeader />
        <SettingsWorkspace />
      </div>
    </AdminDashboardLayout>
  );
}
