"use client";

import { LockKeyhole, PackagePlus, Plus } from "lucide-react";
import { generateVariantSku } from "@/lib/products/variant-sku";
import { useState, type FormEvent } from "react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import styles from "./VariantEditor.module.css";
import type { ProductVariantDetail } from "@/lib/products";

type Props = {
  productName: string;
  existingSkus: string[];
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
  productName,
  existingSkus,
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
      productName={productName}
      existingSkus={existingSkus}
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
  productName,
  existingSkus,
  mode,
  variant,
  submitting,
  errorMessage,
  fieldErrors,
  onClose,
  onSubmit,
}: VariantFormDialogBodyProps) {
  const [name, setName] = useState(variant?.name ?? "");
  const sku = mode === "edit" ? variant?.sku ?? "" : generateVariantSku(productName, name, existingSkus);
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

    if (!price.trim() || !Number.isFinite(priceValue) || priceValue < 0) {
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
      professional
      panelClassName={`${styles.panel} ${styles.variantFormPanel}`}
      title={mode === "create" ? "Add Variant" : `Edit ${variant?.name ?? "Variant"}`}
      description={`Set up variant details for ${productName}.`}
      onClose={() => { if (!submitting) onClose(); }}
    >
      <form noValidate className={`${styles.variantForm} grid gap-4 md:grid-cols-2`} onSubmit={handleSubmit}>
        <div className={styles.variantIntro}>
          <span><PackagePlus size={22} aria-hidden="true" /></span>
          <div><strong>Variant details</strong><p>Set a name and price. The SKU is generated automatically.</p></div>
        </div>
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
        <InventoryField htmlFor="variant-name" label="Variant name" required>
          <input
            id="variant-name"
            value={name}
            maxLength={120}
            disabled={submitting}
            onChange={(event) => setName(event.target.value.replace(/[^\p{L}\p{M}\p{N} .,'?()\/+%&-]/gu, ""))}
            className={inventoryInputClasses}
            placeholder="Ex. 12oz Hot"
          />
        </InventoryField>
        <InventoryField htmlFor="variant-sku" label="SKU">
          <input
            id="variant-sku"
            value={sku}
            readOnly
            aria-describedby="variant-sku-hint"
            className={inventoryInputClasses}
            placeholder="Generated from variant name"
          />
          <p id="variant-sku-hint" className={styles.variantSkuHint}><LockKeyhole size={13} aria-hidden="true" />Automatically generated</p>
        </InventoryField>
        <InventoryField htmlFor="variant-price" label="Price (PHP)" required>
          <input
            id="variant-price"
            value={price}
            inputMode="decimal"
            disabled={submitting}
            onChange={(event) => { if (/^\d{0,10}(\.\d{0,2})?$/.test(event.target.value)) setPrice(event.target.value); }}
            className={inventoryInputClasses}
            placeholder="Ex. 180.00"
          />
        </InventoryField>
        <label className={styles.enabledLabel}>
          <input
            type="checkbox"
            disabled={submitting}
            className={styles.checkbox}
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          <span>Enable variant</span>
        </label>
        <div className={styles.variantActions}>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {mode === "create" && <Plus size={16} aria-hidden="true" />}
            {submitting ? "Saving..." : mode === "create" ? "Create Variant" : "Save Variant"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
