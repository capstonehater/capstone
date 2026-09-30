"use client";
import { useAuthStore } from "@/store/authStore";
import { PermissionAction } from "@/components/auth/PermissionGuard";

import { useMemo, useState, type FormEvent } from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { InventoryField } from "@/components/admin/inventory/InventoryField";
import SupplierLocationPicker from "@/components/admin/inventory/SupplierLocationPicker";
import type { Supplier } from "@/lib/inventory";
import SelectableTableRow from "@/components/admin/SelectableTableRow";
import styles from "./SupplierWorkspace.module.css";

type SupplierInput = {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  contactInfo?: string;
};

type SupplierWorkspaceProps = {
  suppliers: Supplier[];
  submitting: boolean;
  onCreateSupplier: (input: SupplierInput) => Promise<Supplier>;
  onUpdateSupplier: (supplierId: string, input: SupplierInput) => Promise<Supplier>;
  onDeleteSupplier: (supplierId: string) => Promise<void>;
};

type SupplierFormState = {
  name: string;
  latitude: string;
  longitude: string;
  address: string;
  contactInfo: string;
};

const emptyForm: SupplierFormState = { name: "", latitude: "", longitude: "", address: "", contactInfo: "" };

function formFor(supplier?: Supplier | null): SupplierFormState {
  return {
    name: supplier?.name ?? "",
    latitude: supplier?.latitude ?? "",
    longitude: supplier?.longitude ?? "",
    address: supplier?.address ?? "",
    contactInfo: supplier?.contactInfo ?? "",
  };
}

export default function SupplierWorkspace({
  suppliers,
  submitting,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}: SupplierWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(suppliers[0]?.id ?? null);
  const [form, setForm] = useState<SupplierFormState>(() => formFor(suppliers[0]));
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = suppliers.find((supplier) => supplier.id === selectedId) ?? null;
  const filteredSuppliers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return suppliers;
    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contactInfo, supplier.address].some((value) => value?.toLocaleLowerCase().includes(needle))
    );
  }, [query, suppliers]);

  function selectSupplier(supplier: Supplier) {
    setSelectedId(supplier.id);
    setCreating(false);
    setEditing(false);
    setError(null);
    setForm(formFor(supplier));
  }

  function startCreate() {
    setSelectedId(null);
    setCreating(true);
    setEditing(true);
    setError(null);
    setForm(emptyForm);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !useAuthStore.getState().can(creating ? "suppliers.create" : "suppliers.edit")) return;
    setError(null);
    const input: SupplierInput = {
      name: form.name.trim(),
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      address: form.address.trim() || undefined,
      contactInfo: form.contactInfo.trim() || undefined,
    };
    try {
      const saved = creating || !selected
        ? await onCreateSupplier(input)
        : await onUpdateSupplier(selected.id, input);
      setSelectedId(saved.id);
      setCreating(false);
      setEditing(false);
      setForm(formFor(saved));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save supplier.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || submitting || !useAuthStore.getState().can("suppliers.delete")) return;
    setError(null);
    try {
      await onDeleteSupplier(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedId(null);
      setCreating(false);
      setEditing(false);
      setForm(emptyForm);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete supplier.");
      setDeleteTarget(null);
    }
  }

  const fieldsDisabled = !creating && !editing;

  return (
    <>
      <div className={styles.workspace}>
        <section aria-labelledby="supplier-list-title" className={styles.listPanel}>
          <div className={styles.panelHeader}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="supplier-list-title" className="text-lg font-semibold text-slate-900">Suppliers</h2>
                <p className="mt-1 text-xs text-slate-500">{suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}</p>
              </div>
              <PermissionAction permission={"suppliers.create"}><button type="button" onClick={startCreate} disabled={submitting}
                className={styles.primary}>
                <Plus size={16} aria-hidden="true" /> New Supplier
              </button></PermissionAction>
            </div>
            <label className={styles.search}>
              <span className="sr-only">Search suppliers</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search suppliers..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#232d46] focus:ring-2 focus:ring-[#232d46]/10" />
            </label>
          </div>
          <div className="m-3 max-h-[min(65vh,42rem)] overflow-auto rounded-lg border border-slate-300">
            {filteredSuppliers.length ? (
            <table className="w-full table-fixed border-collapse text-xs">
              <caption className="sr-only">Select a supplier to view its details.</caption>
              <thead className="sticky top-0 bg-slate-100 text-left text-[11px] font-bold text-slate-500">
                <tr><th scope="col" className="w-[38%] px-3 py-2">Supplier</th><th scope="col" className="w-[27%] px-2 py-2">Contact</th><th scope="col" className="w-[35%] px-2 py-2">Location</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSuppliers.map((supplier) => {
                  const location = supplier.address || (supplier.latitude != null && supplier.longitude != null ? `${supplier.latitude}, ${supplier.longitude}` : "No location saved");
                  return <SelectableTableRow key={supplier.id} selected={!creating && selectedId === supplier.id} disabled={submitting} onSelect={() => selectSupplier(supplier)}>
                    <td className="px-3 py-2"><p title={supplier.name} className="mb-0! truncate text-xs font-semibold text-slate-900">{supplier.name}</p></td>
                    <td className="px-2 py-2"><p title={supplier.contactInfo || "No contact information"} className="mb-0! truncate text-xs text-slate-700">{supplier.contactInfo || "Not provided"}</p></td>
                    <td className="px-2 py-2"><p title={location} className="mb-0! truncate text-xs text-slate-500">{location}</p></td>
                  </SelectableTableRow>;
                })}
              </tbody>
            </table>
            ) : <p className="px-3 py-8 text-center text-sm text-slate-500">{suppliers.length ? "No suppliers match your search." : "No suppliers yet. Create your first supplier."}</p>}
          </div>
        </section>

        <section id="supplier-details" aria-labelledby="supplier-details-title" className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <h2 id="supplier-details-title" className="text-lg font-semibold text-slate-900">{creating ? "New Supplier" : "Supplier Details"}</h2>
              <p className="mt-1 text-sm text-slate-500">Supplier records are reused across stock runs and cost monitoring.</p>
            </div>
            {!creating && selected ? <span className={styles.badge}>Saved supplier</span> : null}
          </div>
          {error ? <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {creating || selected ? <form onSubmit={(event) => void save(event)} className={styles.form}>
            <InventoryField htmlFor="supplier-name" label="Supplier Name">
              <input id="supplier-name" required maxLength={120} value={form.name} disabled={fieldsDisabled}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Supplier name" className={`${styles.input} disabled:bg-slate-50 disabled:text-slate-600`} />
            </InventoryField>
            <InventoryField htmlFor="supplier-contact" label="Contact Information">
              <input id="supplier-contact" value={form.contactInfo} disabled={fieldsDisabled}
                onChange={(event) => setForm((current) => ({ ...current, contactInfo: event.target.value }))}
                placeholder="Phone or email" className={`${styles.input} disabled:bg-slate-50 disabled:text-slate-600`} />
            </InventoryField>
            <InventoryField htmlFor="supplier-latitude" label="Latitude">
              <input id="supplier-latitude" value={form.latitude} readOnly disabled placeholder="Select a point on the map"
                className={`${styles.input} cursor-not-allowed bg-slate-50 text-slate-600`} />
            </InventoryField>
            <InventoryField htmlFor="supplier-longitude" label="Longitude">
              <input id="supplier-longitude" value={form.longitude} readOnly disabled placeholder="Select a point on the map"
                className={`${styles.input} cursor-not-allowed bg-slate-50 text-slate-600`} />
            </InventoryField>
            <div className="md:col-span-2">
              <SupplierLocationPicker key={creating ? "new" : selectedId ?? "empty"} latitude={form.latitude} longitude={form.longitude} address={form.address}
                readOnly={fieldsDisabled}
                onChange={(location) => setForm((current) => ({ ...current, ...location }))} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 md:col-span-2">
              {!creating && selected ? <>
                <PermissionAction permission={"suppliers.delete"}><button type="button" onClick={() => setDeleteTarget(selected)} disabled={submitting}
                  className="mr-auto inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} /> Delete</button></PermissionAction>
                {editing ? <button type="button" onClick={() => { setEditing(false); setForm(formFor(selected)); setError(null); }} disabled={submitting}
                  className={styles.secondary}>Cancel</button>
                  : <PermissionAction permission={"suppliers.edit"}><button type="button" onClick={() => setEditing(true)} disabled={submitting}
                    className={styles.secondary}>Edit</button></PermissionAction>}
              </> : null}
              {(creating || editing) ? <PermissionAction permission={creating ? "suppliers.create" : "suppliers.edit"}><button type="submit" disabled={submitting}
                className={styles.primary}><Check size={16} />{submitting ? "Saving..." : creating ? "Create Supplier" : "Save Changes"}</button></PermissionAction> : null}
            </div>
          </form> : <div className="p-10 text-center text-sm text-slate-500">Choose a supplier or create a new supplier to view its details.</div>}
        </section>
      </div>

      {deleteTarget ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setDeleteTarget(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="delete-supplier-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
          <header className="bg-[var(--modal-header-background)] flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Warning</p><h2 id="delete-supplier-title" className="mt-1 text-lg font-semibold text-slate-900">Delete Supplier</h2><p className="mt-1 text-sm text-slate-600">Confirm removal of this supplier record.</p></div>
            <button type="button" onClick={() => setDeleteTarget(null)} disabled={submitting} aria-label="Close confirmation" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
          </header>
          <div className="p-5"><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">{deleteTarget.name}</p><p className="mt-1 text-sm text-slate-600">{deleteTarget.contactInfo || "No contact information"}</p><p className="mt-1 text-xs text-slate-500">{deleteTarget.address || "No location saved"}</p></div><p className="mt-4 text-sm text-slate-600">The server will enforce existing supplier deletion rules. Deletion may be blocked when the record is in use.</p></div>
          <footer className="flex justify-end gap-2 border-t border-slate-200 p-4">
            <button type="button" onClick={() => setDeleteTarget(null)} disabled={submitting} className={styles.secondary}>Cancel</button>
            <PermissionAction permission={"suppliers.delete"}><button type="button" onClick={() => void confirmDelete()} disabled={submitting} className="h-10 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{submitting ? "Deleting..." : "Delete Supplier"}</button></PermissionAction>
          </footer>
        </section>
      </div> : null}
    </>
  );
}
