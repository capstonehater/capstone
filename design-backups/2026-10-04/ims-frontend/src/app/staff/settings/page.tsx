"use client";

import StaffDashboardLayout from "@/components/staff-pos/StaffDashboardLayout";
import SettingsWorkspace from "@/components/admin/settings/SettingsWorkspace";
import readable from "@/components/admin/ReadableWorkspace.module.css";
import MyAccountHeader from "@/components/admin/settings/MyAccountHeader";

export default function StaffSettingsPage() {
  return (
    <StaffDashboardLayout showHeader={false}>
      <div className={`${readable.readable} space-y-6`}>
        <MyAccountHeader />
        <SettingsWorkspace />
      </div>
    </StaffDashboardLayout>
  );
}
