"use client";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import ProductsWorkspace from "@/components/admin/products/ProductsWorkspace";

export default function ProductsPage() {
  return (
    <AdminDashboardLayout>
      <div className="flex h-[calc(100vh-60px)] min-h-0 flex-col gap-4 overflow-hidden">
        <section className="border-b border-slate-200 pb-4">
          <h1 className="text-4xl font-black tracking-tight text-neutral-900">PRODUCTS</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Manage menu products, variants, recipes, archive lifecycle, and ingredient usage in a
            focused master-detail workspace.
          </p>
        </section>

        <div className="min-h-0 flex-1 overflow-hidden"><ProductsWorkspace /></div>
      </div>
    </AdminDashboardLayout>
  );
}
