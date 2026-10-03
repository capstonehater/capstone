"use client";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import UsersWorkspace from "@/components/admin/users/UsersWorkspace";

export default function UsersFeature() {
  return (
    <AdminDashboardLayout fillContent showHeader={false}>
      <UsersWorkspace />
    </AdminDashboardLayout>
  );
}
