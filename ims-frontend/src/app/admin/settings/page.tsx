"use client";

import AdminSectionHeader from "@/components/admin/AdminSectionHeader";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import SettingsWorkspace from "@/components/admin/settings/SettingsWorkspace";

export default function SettingsPage() {
  return (
    <AdminDashboardLayout showHeader={false}>
      <div className="space-y-6">
        <AdminSectionHeader title="Settings" description="Manage your account information and security." />

        <SettingsWorkspace />
      </div>
    </AdminDashboardLayout>
  );
}
