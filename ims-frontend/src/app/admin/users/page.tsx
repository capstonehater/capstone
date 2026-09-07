"use client";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import UsersWorkspace from "@/components/admin/users/UsersWorkspace";

export default function UsersPage() {
  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-neutral-900">USERS</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Manage staff accounts, roles, permissions, and account status.
          </p>
        </section>

        <UsersWorkspace />
      </div>
    </AdminDashboardLayout>
  );
}
