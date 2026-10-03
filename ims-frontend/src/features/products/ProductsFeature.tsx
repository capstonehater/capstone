"use client";

import AdminSectionHeader from "@/components/admin/AdminSectionHeader";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import ProductsWorkspace from "@/components/admin/products/ProductsWorkspace";

export default function ProductsFeature() {
  return (
    <AdminDashboardLayout fillContent showHeader={false}>
      <div className="flex h-[calc(100dvh-100px)] min-h-[480px] w-full flex-col gap-5 xl:h-auto xl:min-h-0">
        <AdminSectionHeader title="Products" description="Manage menu products, variants, recipes, archive lifecycle, and ingredient usage." />
        <div className="min-h-0 flex-1 overflow-hidden">
          <ProductsWorkspace />
        </div>
      </div>
    </AdminDashboardLayout>
  );
}
