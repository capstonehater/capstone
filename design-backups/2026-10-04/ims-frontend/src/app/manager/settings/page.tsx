"use client";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import SettingsWorkspace from "@/components/admin/settings/SettingsWorkspace";
import MyAccountHeader from "@/components/admin/settings/MyAccountHeader";

export default function ManagerSettingsPage() {
  return (
    <AdminDashboardLayout showHeader={false}>
      <div className="space-y-6">
        <MyAccountHeader />
        <SettingsWorkspace />
      </div>
    </AdminDashboardLayout>
  );
}
