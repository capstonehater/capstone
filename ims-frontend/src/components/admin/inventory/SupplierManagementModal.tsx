"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import SupplierLocationPicker from "./SupplierLocationPicker";
import type { Supplier } from "@/lib/inventory";

type SupplierFormState = {
  name: string;
  latitude: string;
  longitude: string;
  address: string;
  contactInfo: string;
};

type SupplierManagementModalProps = {
  open: boolean;
  suppliers: Supplier[];
  submitting: boolean;
  onClose: () => void;
  onDeleteSupplier: (supplierId: string) => Promise<void>;
  onCreateSupplier: (input: {
    name: string;
    latitude?: number;
    longitude?: number;
    address?: string;
    contactInfo?: string;
  }) => Promise<Supplier>;
  onUpdateSupplier: (
    supplierId: string,
    input: {
      name?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
      contactInfo?: string;
    }
  ) => Promise<Supplier>;
};

function defaultSupplierForm(supplier?: Supplier | null): SupplierFormState {
  return {
    name: supplier?.name ?? "",
    latitude: supplier?.latitude ?? "",
    longitude: supplier?.longitude ?? "",
    address: supplier?.address ?? "",
    contactInfo: supplier?.contactInfo ?? "",
  };
}

export default function SupplierManagementModal({
  open,
  suppliers,
  submitting,
  onClose,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}: SupplierManagementModalProps) {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierFormState>(defaultSupplierForm());

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === selectedSupplierId) ?? null,
    [selectedSupplierId, suppliers]
  );

  useEffect(() => {
    if (!open) return;

    if (isCreating || suppliers.length === 0) {
      setForm((current) => (current.name ? current : defaultSupplierForm()));
      return;
    }

    const fallbackSupplier = selectedSupplier ?? suppliers[0] ?? null;
    setSelectedSupplierId(fallbackSupplier?.id ?? null);
    setForm(defaultSupplierForm(fallbackSupplier));
  }, [isCreating, open, selectedSupplier, suppliers]);

  if (!open) return null;

  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id);
    setIsCreating(false);
    setForm(defaultSupplierForm(supplier));
  };

  const handleCreateMode = () => {
    setSelectedSupplierId(null);
    setIsCreating(true);
    setForm(defaultSupplierForm());
  };

  const handleDeleteSupplier = async () => {
    if (!selectedSupplier || isCreating || submitting || deleting) return;
    if (!window.confirm(`Delete supplier "${selectedSupplier.name}" permanently? This removes its saved details from the database.`)) return;

    setDeleting(true);
    setDeleteError(null);
    try {
      await onDeleteSupplier(selectedSupplier.id);
      setSelectedSupplierId(null);
      setIsCreating(false);
      setForm(defaultSupplierForm());
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete supplier.");
    } finally {
      setDeleting(false);
    }
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    latitude: form.latitude ? Number(form.latitude) : undefined,
    longitude: form.longitude ? Number(form.longitude) : undefined,
    address: form.address.trim() || undefined,
    contactInfo: form.contactInfo.trim() || undefined,
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isCreating || suppliers.length === 0) {
      const supplier = await onCreateSupplier(buildPayload());
      setIsCreating(false);
      setSelectedSupplierId(supplier.id);
      setForm(defaultSupplierForm(supplier));
      return;
    }

    if (!selectedSupplierId) return;

    const supplier = await onUpdateSupplier(selectedSupplierId, buildPayload());
    setSelectedSupplierId(supplier.id);
    setForm(defaultSupplierForm(supplier));
  };

  return (
    <InventoryModal
      title="Supplier Management"
      description="Create suppliers, inspect supplier details, and update purchasing references used by stock runs and adjustments."
      onClose={onClose}
      wide
    >
      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Suppliers</h3>
              <p className="mt-1 text-xs text-slate-500">
                {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"} available
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCreateMode}
                disabled={submitting || deleting}
                className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                New Supplier
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteSupplier()}
                disabled={!selectedSupplier || isCreating || submitting || deleting}
                className="whitespace-nowrap rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Supplier"}
              </button>
            </div>
          </div>
          {deleteError ? (
            <p role="alert" className="px-4 pt-3 text-sm text-red-600">{deleteError}</p>
          ) : null}
          <div className="max-h-[26rem] overflow-y-auto p-3">
            {suppliers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                No suppliers yet. Create the first supplier on the right.
              </div>
            ) : (
              <div className="space-y-2">
                {suppliers.map((supplier) => {
                  const active = !isCreating && supplier.id === selectedSupplierId;
                  return (
                    <button
                      key={supplier.id}
                      type="button"
                      onClick={() => handleSelectSupplier(supplier)}
                      disabled={submitting || deleting}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? "border-[#f45a1f] bg-orange-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="font-semibold text-slate-900">{supplier.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {supplier.contactInfo || supplier.address || "No contact details yet"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {isCreating ? "Create Supplier" : selectedSupplier ? "Supplier Details" : "Supplier Form"}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Supplier records are reused across stock runs, adjustments, and cost monitoring.
              </p>
            </div>
            {!isCreating && selectedSupplier ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Editing
              </span>
            ) : null}
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => void handleSubmit(event)}>
            <InventoryField htmlFor="supplier-name" label="Supplier name">
              <input
                id="supplier-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="FreshMart Supply"
                className={inventoryInputClasses}
              />
            </InventoryField>

            <InventoryField htmlFor="supplier-contact" label="Contact info">
              <input
                id="supplier-contact"
                value={form.contactInfo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactInfo: event.target.value }))
                }
                placeholder="0917-000-0000 / purchasing@freshmart.com"
                className={inventoryInputClasses}
              />
            </InventoryField>

            <InventoryField htmlFor="supplier-latitude" label="Latitude">
              <input
                id="supplier-latitude"
                type="text"
                value={form.latitude}
                readOnly
                disabled
                placeholder="Select a location on the map"
                className={inventoryInputClasses + " cursor-not-allowed bg-slate-100 text-slate-600"}
              />
            </InventoryField>

            <InventoryField htmlFor="supplier-longitude" label="Longitude">
              <input
                id="supplier-longitude"
                type="text"
                value={form.longitude}
                readOnly
                disabled
                placeholder="Select a location on the map"
                className={inventoryInputClasses + " cursor-not-allowed bg-slate-100 text-slate-600"}
              />
            </InventoryField>

            <div className="md:col-span-2">
              <SupplierLocationPicker
                key={isCreating ? "new" : selectedSupplierId ?? "empty"}
                latitude={form.latitude}
                longitude={form.longitude}
                address={form.address}
                onChange={(location) => setForm((current) => ({ ...current, ...location }))}
              />
            </div>

            <div className="md:col-span-2 flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
              {!isCreating && selectedSupplier ? (
                <button
                  type="button"
                  onClick={handleCreateMode}
                  disabled={submitting || deleting}
                  className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
                >
                  Create Another
                </button>
              ) : null}
              <button
                type="submit"
                disabled={submitting || deleting}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
              >
                {isCreating ? "Create Supplier" : "Save Supplier"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </InventoryModal>
  );
}
