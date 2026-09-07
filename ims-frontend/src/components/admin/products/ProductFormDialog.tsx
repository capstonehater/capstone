"use client";

import { useState, type FormEvent } from "react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { ProductCategory, ProductDetail, VariantFormInput } from "@/lib/products";

type Props = {
  mode: "create" | "edit";
  open: boolean;
  categories: ProductCategory[];
  product: ProductDetail | null;
  submitting: boolean;
  errorMessage?: string | null;
  fieldErrors?: Record<string, string[]>;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    categoryId: string;
    isEnabled: boolean;
    initialVariants: VariantFormInput[];
  }) => Promise<void>;
};

function emptyVariant(): VariantFormInput {
  return { name: "", sku: "", price: "", isEnabled: true };
}

export default function ProductFormDialog({
  mode,
  open,
  categories,
  product,
  submitting,
  errorMessage,
  fieldErrors,
  onClose,
  onSubmit,
}: Props) {
  if (!open) {
    return null;
  }

  const formKey = `${mode}:${product?.id ?? "new"}:${open ? "open" : "closed"}`;

  return (
    <ProductFormDialogBody
      key={formKey}
      mode={mode}
      categories={categories}
      product={product}
      submitting={submitting}
      errorMessage={errorMessage}
      fieldErrors={fieldErrors}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

type ProductFormDialogBodyProps = Omit<Props, "open">;

function ProductFormDialogBody({
  mode,
  categories,
  product,
  submitting,
  errorMessage,
  fieldErrors,
  onClose,
  onSubmit,
}: ProductFormDialogBodyProps) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(
    product?.category.id ?? categories[0]?.id ?? "",
  );
  const [isEnabled, setIsEnabled] = useState(
    product?.manualAvailability !== "DISABLED",
  );
  const [variants, setVariants] = useState<VariantFormInput[]>([emptyVariant()]);
  const [clientErrors, setClientErrors] = useState<string[]>([]);

  function validate() {
    const nextErrors: string[] = [];

    if (!name.trim()) {
      nextErrors.push("Product name is required.");
    }

    if (!categoryId) {
      nextErrors.push("Category is required.");
    }

    if (mode === "create") {
      if (variants.length === 0) {
        nextErrors.push("At least one initial variant is required.");
      }

      const variantNames = new Set<string>();
      const variantSkus = new Set<string>();

      variants.forEach((variant, index) => {
        const trimmedName = variant.name.trim();
        const trimmedSku = variant.sku.trim();
        const priceValue = Number(variant.price);

        if (!trimmedName) {
          nextErrors.push(`Variant ${index + 1}: name is required.`);
        } else if (variantNames.has(trimmedName.toLowerCase())) {
          nextErrors.push(`Variant ${index + 1}: duplicate variant name.`);
        } else {
          variantNames.add(trimmedName.toLowerCase());
        }

        if (!trimmedSku) {
          nextErrors.push(`Variant ${index + 1}: SKU is required.`);
        } else if (variantSkus.has(trimmedSku.toLowerCase())) {
          nextErrors.push(`Variant ${index + 1}: duplicate SKU.`);
        } else {
          variantSkus.add(trimmedSku.toLowerCase());
        }

        if (!variant.price.trim() || Number.isNaN(priceValue) || priceValue < 0) {
          nextErrors.push(
            `Variant ${index + 1}: price must be a valid non-negative number.`,
          );
        }
      });
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
      categoryId,
      isEnabled,
      initialVariants:
        mode === "create"
          ? variants.map((variant) => ({
              ...variant,
              name: variant.name.trim(),
              sku: variant.sku.trim(),
              price: variant.price.trim(),
            }))
          : [],
    });
  }

  return (
    <InventoryModal
      title={mode === "create" ? "Add Product" : `Edit ${product?.name ?? "Product"}`}
      description={
        mode === "create"
          ? "Create a product with its first variants so the detail workspace is immediately useful."
          : "Update product metadata without touching existing order or inventory history."
      }
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

        <InventoryField htmlFor="product-name" label="Product name">
          <input
            id="product-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inventoryInputClasses}
            placeholder="Spanish Latte"
          />
        </InventoryField>

        <InventoryField htmlFor="product-category" label="Category">
          <select
            id="product-category"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            className={inventoryInputClasses}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </InventoryField>

        <label className="md:col-span-2 inline-flex items-center gap-3 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
          />
          Product manually enabled
        </label>

        {mode === "create" ? (
          <div className="md:col-span-2 space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Initial variants</h3>
                <p className="text-xs text-slate-500">
                  Add at least one variant so recipe setup can begin immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVariants((current) => [...current, emptyVariant()])}
                className="text-sm font-semibold text-[#f45a1f]"
              >
                Add variant
              </button>
            </div>
            {variants.map((variant, index) => (
              <div key={index} className="grid gap-3 rounded-3xl bg-white p-4 md:grid-cols-4">
                <input
                  value={variant.name}
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Variant name"
                  className={inventoryInputClasses}
                />
                <input
                  value={variant.sku}
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, sku: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="SKU"
                  className={inventoryInputClasses}
                />
                <input
                  value={variant.price}
                  onChange={(event) =>
                    setVariants((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, price: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Price"
                  className={inventoryInputClasses}
                />
                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={variant.isEnabled}
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, isEnabled: event.target.checked }
                              : item,
                          ),
                        )
                      }
                    />
                    Enabled
                  </label>
                  {variants.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setVariants((current) =>
                          current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="text-sm font-semibold text-rose-700"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

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
            {submitting ? "Saving..." : mode === "create" ? "Create Product" : "Save Changes"}
          </button>
        </div>
      </form>
    </InventoryModal>
  );
}
