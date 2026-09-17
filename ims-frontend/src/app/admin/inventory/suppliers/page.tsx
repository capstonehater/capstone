"use client";

import { useCallback, useEffect, useState } from "react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import SupplierWorkspace from "@/components/admin/suppliers/SupplierWorkspace";
import { createSupplier, deleteSupplier, fetchSuppliers, updateSupplier, type Supplier } from "@/lib/inventory";
import { useInventoryStore } from "@/store/inventoryStore";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const activeSupplierFilter = useInventoryStore((state) => state.supplierId);
  const setActiveSupplierFilter = useInventoryStore((state) => state.setSupplierId);

  const refreshSuppliers = useCallback(async () => {
    const latest = await fetchSuppliers();
    setSuppliers(latest);
    return latest;
  }, []);

  useEffect(() => {
    let active = true;
    void fetchSuppliers().then((result) => {
      if (active) setSuppliers(result);
    }).catch((error: unknown) => {
      if (active) setLoadError(error instanceof Error ? error.message : "Unable to load suppliers.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function create(input: Parameters<typeof createSupplier>[0]) {
    setSubmitting(true);
    try {
      const supplier = await createSupplier(input);
      await refreshSuppliers();
      return supplier;
    } finally {
      setSubmitting(false);
    }
  }

  async function update(id: string, input: Parameters<typeof updateSupplier>[1]) {
    setSubmitting(true);
    try {
      const supplier = await updateSupplier(id, input);
      await refreshSuppliers();
      return supplier;
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(id: string) {
    setSubmitting(true);
    try {
      await deleteSupplier(id);
      if (activeSupplierFilter === id) setActiveSupplierFilter("");
      await refreshSuppliers();
    } finally {
      setSubmitting(false);
    }
  }

  return <AdminDashboardLayout>
    <main className="min-h-full bg-[#f5f5f5] p-4 sm:p-6">
      <header className="mb-5 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Supplier Management</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Create suppliers, inspect supplier details, and update purchasing references used by stock runs.</p>
      </header>
      {loadError ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p> : null}
      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading suppliers...</div>
        : <SupplierWorkspace suppliers={suppliers} submitting={submitting} onCreateSupplier={create} onUpdateSupplier={update} onDeleteSupplier={remove} />}
    </main>
  </AdminDashboardLayout>;
}
