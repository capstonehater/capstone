"use client";

import { useState, type FormEvent } from "react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { ProductVariantDetail } from "@/lib/products";

type Props = {
  mode: "create" | "edit";
  open: boolean;
  variant: ProductVariantDetail | null;
  submitting: boolean;
  errorMessage?: string | null;
  fieldErrors?: Record<string, string[]>;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    sku: string;
    price: string;
    isEnabled: boolean;
  }) => Promise<void>;
};

export default function VariantFormDialog({
  mode,
  open,
  variant,
  submitting,
  errorMessage,
  fieldErrors,
  onClose,
  onSubmit,
}: Props) {
  if (!open) {
    return null;
  }

  const formKey = `${mode}:${variant?.id ?? "new"}:${open ? "open" : "closed"}`;

  return (
    <VariantFormDialogBody
      key={formKey}
      mode={mode}
      variant={variant}
      submitting={submitting}
      errorMessage={errorMessage}
      fieldErrors={fieldErrors}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

type VariantFormDialogBodyProps = Omit<Props, "open">;

function VariantFormDialogBody({
  mode,
  variant,
  submitting,
  errorMessage,
  fieldErrors,
  onClose,
  onSubmit,
}: VariantFormDialogBodyProps) {
  const [name, setName] = useState(variant?.name ?? "");
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [price, setPrice] = useState(variant?.price ?? "");
  const [isEnabled, setIsEnabled] = useState(
    variant?.manualAvailability !== "DISABLED",
  );
  const [clientErrors, setClientErrors] = useState<string[]>([]);

  function validate() {
    const nextErrors: string[] = [];
    const priceValue = Number(price);

    if (!name.trim()) {
      nextErrors.push("Variant name is required.");
    }

    if (!sku.trim()) {
      nextErrors.push("SKU is required.");
    }

    if (!price.trim() || Number.isNaN(priceValue) || priceValue < 0) {
      nextErrors.push("Price must be a valid non-negative number.");
    }

    setClientErrors(nextErrors);
    return nextErrors.length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    await onSubmit({
      name: name.trim(),
      sku: sku.trim(),
      price: price.trim(),
      isEnabled,
    });
  }

  return (
    <InventoryModal
      title={mode === "create" ? "Add Variant" : `Edit ${variant?.name ?? "Variant"}`}
      description="Manage a product variant without leaving the selected product workspace."
      onClose={onClose}
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
        {clientErrors.length > 0 ? (
          <div className="md:col-span-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <ul className="space-y-1">
              {clientErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {errorMessage ? (
          <div className="md:col-span-2 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p>{errorMessage}</p>
            {fieldErrors ? (
              <ul className="mt-2 space-y-1">
                {Object.entries(fieldErrors).map(([field, messages]) => (
                  <li key={field}>
                    {field}: {messages.join(", ")}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <InventoryField htmlFor="variant-name" label="Variant name">
          <input
            id="variant-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inventoryInputClasses}
            placeholder="12oz Hot"
          />
        </InventoryField>
        <InventoryField htmlFor="variant-sku" label="SKU">
          <input
            id="variant-sku"
            value={sku}
            onChange={(event) => setSku(event.target.value)}
            className={inventoryInputClasses}
            placeholder="SL-12H"
          />
        </InventoryField>
        <InventoryField htmlFor="variant-price" label="Price">
          <input
            id="variant-price"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={inventoryInputClasses}
            placeholder="180.00"
          />
        </InventoryField>
        <label className="inline-flex items-center gap-3 self-end text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          Variant manually enabled
        </label>
        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : mode === "create" ? "Create Variant" : "Save Variant"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
