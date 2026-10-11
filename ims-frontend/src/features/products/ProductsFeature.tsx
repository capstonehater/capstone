"use client";

import AdminSectionHeader from "@/components/admin/AdminSectionHeader";

import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import ProductsWorkspace from "@/components/admin/products/ProductsWorkspace";

export default function ProductsFeature() {
  return (
    <AdminDashboardLayout fillContent showHeader={false}>
      <div className="flex w-full flex-col gap-5 xl:h-full xl:min-h-0">
        <AdminSectionHeader title="Products" description="Manage menu products, variants, recipes, archive lifecycle, and ingredient usage." />
        <div className="min-h-0 xl:flex-1 xl:overflow-hidden">
          <ProductsWorkspace />
        </div>
      </div>
    </AdminDashboardLayout>
  );
}
