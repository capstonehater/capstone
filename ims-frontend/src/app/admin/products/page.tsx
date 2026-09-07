"use client";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import ProductsWorkspace from "@/components/admin/products/ProductsWorkspace";

export default function ProductsPage() {
  return (
    <AdminDashboardLayout>
      <div className="space-y-6">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-neutral-900">Product Management</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Manage menu products, variants, recipes, archive lifecycle, and ingredient usage in a
            focused master-detail workspace.
          </p>
        </section>

        <ProductsWorkspace />
      </div>
    </AdminDashboardLayout>
  );
}

