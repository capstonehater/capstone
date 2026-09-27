"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { Check, Plus, Search, Trash2, X } from "lucide-react";
import { InventoryField, inventoryInputClasses } from "@/components/admin/inventory/InventoryField";
import SupplierLocationPicker from "@/components/admin/inventory/SupplierLocationPicker";
import type { Supplier } from "@/lib/inventory";

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
  onUpdateSupplier,
  onDeleteSupplier,
}: SupplierWorkspaceProps) {
  const [selectedId, setSelectedId] = useState<string | null>(suppliers[0]?.id ?? null);
  const [form, setForm] = useState<SupplierFormState>(() => formFor(suppliers[0]));
  const [query, setQuery] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [editing, setEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = suppliers.find((supplier) => supplier.id === selectedId) ?? null;
  const filteredSuppliers = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return suppliers.filter((supplier) => {
      const matchesSearch = !needle || [supplier.name, supplier.contactInfo, supplier.address]
        .some((value) => value?.toLocaleLowerCase().includes(needle));
      const hasContact = Boolean(supplier.contactInfo?.trim());
      const hasLocation = Boolean(supplier.address?.trim() || (supplier.latitude != null && supplier.longitude != null));
      return matchesSearch
        && (!contactFilter || (contactFilter === "present" ? hasContact : !hasContact))
        && (!locationFilter || (locationFilter === "present" ? hasLocation : !hasLocation));
    }).sort((a, b) => sortOrder === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  }, [query, contactFilter, locationFilter, sortOrder, suppliers]);

  function selectSupplier(supplier: Supplier) {
    setSelectedId(supplier.id);
    setEditing(false);
    setError(null);
    setForm(formFor(supplier));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !selected) return;
    setError(null);
    const input: SupplierInput = {
      name: form.name.trim(),
      latitude: form.latitude ? Number(form.latitude) : undefined,
      longitude: form.longitude ? Number(form.longitude) : undefined,
      address: form.address.trim() || undefined,
      contactInfo: form.contactInfo.trim() || undefined,
    };
    try {
      const saved = await onUpdateSupplier(selected.id, input);
      setSelectedId(saved.id);
        setEditing(false);
      setForm(formFor(saved));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save supplier.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || submitting) return;
    setError(null);
    try {
      await onDeleteSupplier(deleteTarget.id);
      setDeleteTarget(null);
      setSelectedId(null);
        setEditing(false);
      setForm(emptyForm);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete supplier.");
      setDeleteTarget(null);
    }
  }

  const fieldsDisabled = !editing;

  return (
    <>
      <div className="grid min-w-0 items-start gap-5">
        <section aria-labelledby="supplier-list-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 id="supplier-list-title" className="text-lg font-semibold text-slate-900">Suppliers</h2>
                <p className="mt-1 text-xs text-slate-500">{filteredSuppliers.length} of {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}</p>
              </div>
              <Link href="/admin/inventory/suppliers/new"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#232d46] px-3 text-sm font-semibold text-white transition hover:bg-[#1b2438] disabled:opacity-50">
                <Plus size={16} aria-hidden="true" /> New Supplier
              </Link>
            </div>
            <div className="mt-4 grid items-end gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]">
            <label className="relative block">
              <span className="sr-only">Search suppliers</span>
              <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, contact, or address..."
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-[#232d46] focus:ring-2 focus:ring-[#232d46]/10" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Contact information
              <select value={contactFilter} onChange={(event) => setContactFilter(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
                <option value="">All contacts</option><option value="present">With contact info</option><option value="missing">Missing contact info</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Location
              <select value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
                <option value="">All locations</option><option value="present">With saved location</option><option value="missing">Missing location</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Sort by name
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
                <option value="asc">A to Z</option><option value="desc">Z to A</option>
              </select>
            </label>
            </div>
            {query || contactFilter || locationFilter ? <button type="button" className="mt-3 text-sm font-semibold text-[#232d46] underline" onClick={() => { setQuery(""); setContactFilter(""); setLocationFilter(""); }}>Clear search and filters</button> : null}
          </div>
          <div className="max-h-[min(65vh,42rem)] overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <caption className="sr-only">Suppliers directory. Select View details to manage a supplier below the table.</caption>
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{["Supplier", "Contact information", "Location", "Actions"].map((heading) => <th key={heading} scope="col" className="border-b border-slate-200 px-5 py-4 font-semibold">{heading}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredSuppliers.map((supplier) => {
                  const active = selectedId === supplier.id;
                  return <tr key={supplier.id} className={active ? "bg-emerald-50" : "hover:bg-slate-50"}>
                    <td className="px-5 py-4 font-semibold text-slate-900">{supplier.name}</td>
                    <td className="px-5 py-4 text-slate-600">{supplier.contactInfo || "No contact information"}</td>
                    <td className="max-w-md px-5 py-4 text-slate-500">{supplier.address || (supplier.latitude != null && supplier.longitude != null ? `${supplier.latitude}, ${supplier.longitude}` : "No location saved")}</td>
                    <td className="px-5 py-4"><button type="button" onClick={() => selectSupplier(supplier)} disabled={submitting}
                      aria-label={`View details for ${supplier.name}`} aria-controls="supplier-details" aria-current={active ? "true" : undefined}
                      className="whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold text-[#232d46] hover:bg-slate-100 disabled:opacity-50">{active ? "Viewing details" : "View details"}</button></td>
                  </tr>;
                })}
                {!filteredSuppliers.length && <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">{suppliers.length ? "No suppliers match your search and filters." : "No suppliers yet. Create your first supplier."}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section id="supplier-details" aria-labelledby="supplier-details-title" className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h2 id="supplier-details-title" className="text-lg font-semibold text-slate-900">Supplier Details</h2>
              <p className="mt-1 text-sm text-slate-500">Supplier records are reused across stock runs and cost monitoring.</p>
            </div>
            {selected ? <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">Saved supplier</span> : null}
          </div>
          {error ? <p role="alert" className="mx-5 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {selected ? <form onSubmit={(event) => void save(event)} className="grid gap-5 p-5 md:grid-cols-2">
            <InventoryField htmlFor="supplier-name" label="Supplier Name">
              <input id="supplier-name" required maxLength={120} value={form.name} disabled={fieldsDisabled}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Supplier name" className={`${inventoryInputClasses} disabled:bg-slate-50 disabled:text-slate-600`} />
            </InventoryField>
            <InventoryField htmlFor="supplier-contact" label="Contact Information">
              <input id="supplier-contact" value={form.contactInfo} disabled={fieldsDisabled}
                onChange={(event) => setForm((current) => ({ ...current, contactInfo: event.target.value }))}
                placeholder="Phone or email" className={`${inventoryInputClasses} disabled:bg-slate-50 disabled:text-slate-600`} />
            </InventoryField>
            <InventoryField htmlFor="supplier-latitude" label="Latitude">
              <input id="supplier-latitude" value={form.latitude} readOnly disabled placeholder="Select a point on the map"
                className={`${inventoryInputClasses} cursor-not-allowed bg-slate-50 text-slate-600`} />
            </InventoryField>
            <InventoryField htmlFor="supplier-longitude" label="Longitude">
              <input id="supplier-longitude" value={form.longitude} readOnly disabled placeholder="Select a point on the map"
                className={`${inventoryInputClasses} cursor-not-allowed bg-slate-50 text-slate-600`} />
            </InventoryField>
            <div className="md:col-span-2">
              <SupplierLocationPicker key={selectedId ?? "empty"} latitude={form.latitude} longitude={form.longitude} address={form.address}
                readOnly={fieldsDisabled}
                onChange={(location) => setForm((current) => ({ ...current, ...location }))} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 md:col-span-2">
              {selected ? <>
                <button type="button" onClick={() => setDeleteTarget(selected)} disabled={submitting}
                  className="mr-auto inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={15} /> Delete</button>
                {editing ? <button type="button" onClick={() => { setEditing(false); setForm(formFor(selected)); setError(null); }} disabled={submitting}
                  className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                  : <button type="button" onClick={() => setEditing(true)} disabled={submitting}
                    className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Edit</button>}
              </> : null}
              {editing ? <button type="submit" disabled={submitting}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#232d46] px-4 text-sm font-semibold text-white hover:bg-[#1b2438] disabled:opacity-50"><Check size={16} />{submitting ? "Saving..." : "Save Changes"}</button> : null}
            </div>
          </form> : <div className="p-10 text-center text-sm text-slate-500">Choose a supplier or create a new supplier to view its details.</div>}
        </section>
      </div>

      {deleteTarget ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setDeleteTarget(null); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="delete-supplier-title" className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
          <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
            <div><p className="text-xs font-semibold uppercase tracking-wide text-red-700">Warning</p><h2 id="delete-supplier-title" className="mt-1 text-lg font-semibold text-slate-900">Delete Supplier</h2><p className="mt-1 text-sm text-slate-600">Confirm removal of this supplier record.</p></div>
            <button type="button" onClick={() => setDeleteTarget(null)} disabled={submitting} aria-label="Close confirmation" className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
          </header>
          <div className="p-5"><div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><p className="font-semibold text-slate-900">{deleteTarget.name}</p><p className="mt-1 text-sm text-slate-600">{deleteTarget.contactInfo || "No contact information"}</p><p className="mt-1 text-xs text-slate-500">{deleteTarget.address || "No location saved"}</p></div><p className="mt-4 text-sm text-slate-600">The server will enforce existing supplier deletion rules. Deletion may be blocked when the record is in use.</p></div>
          <footer className="flex justify-end gap-2 border-t border-slate-200 p-4">
            <button type="button" onClick={() => setDeleteTarget(null)} disabled={submitting} className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={() => void confirmDelete()} disabled={submitting} className="h-10 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">{submitting ? "Deleting..." : "Delete Supplier"}</button>
          </footer>
        </section>
      </div> : null}
    </>
  );
}
