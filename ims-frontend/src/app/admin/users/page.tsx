"use client";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import UsersWorkspace from "@/components/admin/users/UsersWorkspace";

export default function UsersPage() {
  return (
    <AdminDashboardLayout fillContent showHeader={false}>
      <UsersWorkspace />
    </AdminDashboardLayout>
  );
}
