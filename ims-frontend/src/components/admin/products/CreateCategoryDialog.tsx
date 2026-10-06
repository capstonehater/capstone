"use client";

import { useState, type FormEvent } from "react";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import { InventoryField, inventoryInputClasses } from "@/components/admin/inventory/InventoryField";
import { createProductCategory, normalizeProductError, type ProductCategory } from "@/lib/products";
import InventoryValidationField from "@/components/admin/inventory/InventoryValidationField";

export default function CreateCategoryDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (category: ProductCategory) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!name.trim()) { setFieldError("Category name is required."); return; }
    if (!/^[\p{L}\p{M} ]+$/u.test(name)) { setFieldError("Use letters and spaces only."); return; }
    if (fieldError) return;
    setSubmitting(true);
    setError(null);
    try {
      onCreated(await createProductCategory(name.trim()));
    } catch (error) {
      setError(normalizeProductError(error, "Failed to create category.").message);
    } finally { setSubmitting(false); }
  }

  return <InventoryModal professional panelClassName="categoryCreateDialog" title="Create Category" description="Add a category to organize your products." onClose={() => { if (!submitting) onClose(); }}>
    <form noValidate onSubmit={handleSubmit} className="space-y-4">
      {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      <InventoryValidationField error={fieldError}>
        <InventoryField htmlFor="new-category-name" label="Category name" required>
          <input id="new-category-name" className={inventoryInputClasses} aria-invalid={!!fieldError} autoFocus required maxLength={120} disabled={submitting} value={name} onChange={event => {
            const value = event.target.value;
            if (!/^[\p{L}\p{M} ]*$/u.test(value)) {
              setFieldError("Use letters and spaces only. Numbers and symbols are not allowed.");
              return;
            }
            setName(value);
            setFieldError(value.trim() ? undefined : "Category name is required.");
            setError(null);
          }} placeholder="Ex. Desserts" />
        </InventoryField>
      </InventoryValidationField>
      <div className="flex justify-end gap-3">
        <button type="submit" disabled={submitting || !name.trim() || !!fieldError}>{submitting ? "Creating..." : "Create Category"}</button>
      </div>
    </form>
  </InventoryModal>;
}
