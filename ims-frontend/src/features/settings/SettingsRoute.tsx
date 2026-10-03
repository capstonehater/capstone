"use client";

import { useAuthStore } from "@/store/authStore";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import StaffDashboardLayout from "@/components/staff-pos/StaffDashboardLayout";
import SettingsFeature from "./SettingsFeature";

export default function SettingsRoute() {
  const role = useAuthStore(state => state.user?.role);
  if (role === "STAFF") return <StaffDashboardLayout showHeader={false}><SettingsFeature /></StaffDashboardLayout>;
  return <AdminDashboardLayout showHeader={role !== "ADMINISTRATOR"}><SettingsFeature presentation={role === "MANAGER" ? "account" : "standard"} /></AdminDashboardLayout>;
}
