"use client";

import { useEffect, useState } from "react";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import SupplierManagementModal from "@/components/admin/inventory/SupplierManagementModal";
import { createSupplier, deleteSupplier, fetchSuppliers, updateSupplier, type Supplier } from "@/lib/inventory";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { void fetchSuppliers().then(setSuppliers).finally(() => setLoading(false)); }, []);
  async function create(input: Parameters<typeof createSupplier>[0]) { setSubmitting(true); try { const s = await createSupplier(input); setSuppliers(await fetchSuppliers()); return s; } finally { setSubmitting(false); } }
  async function update(id: string, input: Parameters<typeof updateSupplier>[1]) { setSubmitting(true); try { const s = await updateSupplier(id, input); setSuppliers(await fetchSuppliers()); return s; } finally { setSubmitting(false); } }
  async function remove(id: string) { setSubmitting(true); try { const s = await deleteSupplier(id); setSuppliers(await fetchSuppliers()); return s; } finally { setSubmitting(false); } }
  return <AdminDashboardLayout><main className="min-h-full bg-[#f5f5f5] p-6"><header className="mb-6 border-b border-slate-200 pb-4"><h1 className="text-3xl font-black text-slate-900">Supplier Management</h1><p className="mt-1 text-sm text-slate-600">Create suppliers, inspect supplier details, and update purchasing references used by stock runs and adjustments.</p></header>{loading ? <p className="text-sm text-slate-600">Loading suppliers...</p> : <SupplierManagementModal open suppliers={suppliers} submitting={submitting} onClose={() => {}} onCreateSupplier={create} onUpdateSupplier={update} onDeleteSupplier={remove} pageMode />}</main></AdminDashboardLayout>;
}
