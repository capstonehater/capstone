"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import AdminDashboardLayout from "@/components/admin/AdminDashboardLayout";
import { InventoryField, inventoryInputClasses } from "@/components/admin/inventory/InventoryField";
import SupplierLocationPicker from "@/components/admin/inventory/SupplierLocationPicker";
import ActionAlert from "@/components/feedback/ActionAlert";
import { createSupplier } from "@/lib/inventory";

export default function NewSupplierPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", contactInfo: "", address: "", latitude: "", longitude: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!form.name.trim()) { setError("Enter a supplier name."); return; }
    setSubmitting(true);
    setError(null);
    try {
      await createSupplier({
        name: form.name.trim(), contactInfo: form.contactInfo.trim() || undefined,
        address: form.address.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      router.push("/admin/inventory/suppliers");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to create supplier.");
      setSubmitting(false);
    }
  }

  return <AdminDashboardLayout>
    <main className="min-h-full bg-[#f5f5f5] p-4 sm:p-6">
      <Link href="/admin/inventory/suppliers" className="mb-4 inline-block text-sm font-semibold text-[#232d46] hover:underline">Back to suppliers</Link>
      {error && <ActionAlert tone="error" title="Unable to create supplier" message={error} onDismiss={() => setError(null)} />}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <h1 className="text-2xl font-bold text-slate-900">New Supplier</h1>
          <p className="mt-1 text-sm text-slate-500">Add contact details and a location for purchasing and stock runs.</p>
        </header>
        <form onSubmit={(event) => void save(event)} className="p-5">
          <fieldset disabled={submitting} className="grid gap-5 md:grid-cols-2">
            <legend className="sr-only">Supplier details</legend>
            <InventoryField htmlFor="supplier-name" label="Supplier Name">
              <input id="supplier-name" required maxLength={120} value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} placeholder="Supplier name" className={inventoryInputClasses} />
            </InventoryField>
            <InventoryField htmlFor="supplier-contact" label="Contact Information">
              <input id="supplier-contact" value={form.contactInfo} onChange={(event) => setForm((previous) => ({ ...previous, contactInfo: event.target.value }))} placeholder="Phone or email" className={inventoryInputClasses} />
            </InventoryField>
            <InventoryField htmlFor="supplier-latitude" label="Latitude">
              <input id="supplier-latitude" value={form.latitude} readOnly disabled placeholder="Select a point on the map" className={`${inventoryInputClasses} bg-slate-50`} />
            </InventoryField>
            <InventoryField htmlFor="supplier-longitude" label="Longitude">
              <input id="supplier-longitude" value={form.longitude} readOnly disabled placeholder="Select a point on the map" className={`${inventoryInputClasses} bg-slate-50`} />
            </InventoryField>
            <div className="md:col-span-2">
              <SupplierLocationPicker latitude={form.latitude} longitude={form.longitude} address={form.address} readOnly={submitting} onChange={(location) => setForm((previous) => ({ ...previous, ...location }))} />
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 md:col-span-2">
              <button type="button" onClick={() => router.push("/admin/inventory/suppliers")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
              <button type="submit" className="rounded-lg bg-[#232d46] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Creating..." : "Create Supplier"}</button>
            </div>
          </fieldset>
        </form>
      </section>
    </main>
  </AdminDashboardLayout>;
}
