"use client";

import { useMemo, useState } from "react";
import {
  InventoryField,
  inventoryInputClasses,
} from "@/components/admin/inventory/InventoryField";
import InventoryModal from "@/components/admin/inventory/InventoryModal";
import type { InventorySummaryItem } from "@/lib/inventory";
import type { ProductRecipe } from "@/lib/products";

type RecipeDraftRow = {
  rawMaterialId: string;
  quantity: string;
};

type Props = {
  open: boolean;
  recipe: ProductRecipe | null;
  materials: InventorySummaryItem[];
  loading: boolean;
  submitting: boolean;
  onClose: () => void;
  onSave: (items: Array<{ rawMaterialId: string; quantity: string }>) => Promise<void>;
};

function createDraftFromRecipe(recipe: ProductRecipe | null): RecipeDraftRow[] {
  if (!recipe || recipe.items.length === 0) {
    return [{ rawMaterialId: "", quantity: "" }];
  }

  return recipe.items.map((item) => ({
    rawMaterialId: item.rawMaterialId,
    quantity: item.quantity,
  }));
}

export default function RecipeEditor({
  open,
  recipe,
  materials,
  loading,
  submitting,
  onClose,
  onSave,
}: Props) {
  const [rows, setRows] = useState<RecipeDraftRow[]>(createDraftFromRecipe(recipe));
  const [errors, setErrors] = useState<string[]>([]);

  const normalizedRecipe = useMemo(() => createDraftFromRecipe(recipe), [recipe]);
  const isDirty = JSON.stringify(rows) !== JSON.stringify(normalizedRecipe);

  if (!open) {
    return null;
  }

  function validate() {
    const nextErrors: string[] = [];
    const seenMaterials = new Set<string>();

    rows.forEach((row, index) => {
      if (!row.rawMaterialId) {
        nextErrors.push(`Ingredient row ${index + 1}: raw material is required.`);
      }

      if (row.rawMaterialId) {
        if (seenMaterials.has(row.rawMaterialId)) {
          nextErrors.push(`Ingredient row ${index + 1}: duplicate raw material.`);
        }
        seenMaterials.add(row.rawMaterialId);
      }

      const quantityValue = Number(row.quantity);
      if (!row.quantity.trim()) {
        nextErrors.push(`Ingredient row ${index + 1}: quantity is required.`);
      } else if (Number.isNaN(quantityValue)) {
        nextErrors.push(`Ingredient row ${index + 1}: quantity must be a valid decimal.`);
      } else if (quantityValue <= 0) {
        nextErrors.push(`Ingredient row ${index + 1}: quantity must be greater than zero.`);
      }
    });

    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  async function handleClose() {
    if (isDirty && !window.confirm("Discard unsaved recipe changes?")) {
      return;
    }
    onClose();
  }

  async function handleSave() {
    if (!validate()) {
      return;
    }

    await onSave(
      rows.map((row) => ({
        rawMaterialId: row.rawMaterialId,
        quantity: row.quantity.trim(),
      })),
    );
  }

  return (
    <InventoryModal
      title={`Edit Recipe${recipe ? ` for ${recipe.variantName}` : ""}`}
      description="Recipe changes affect future sales consumption and availability calculations. Historical ingredient deductions are not rewritten."
      onClose={() => void handleClose()}
      wide
    >
      <div className="space-y-5">
        {errors.length > 0 ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <ul className="space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          Use this editor to define the base raw-material recipe for future sales. Modifier-driven
          adjustments and historical deductions remain untouched.
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Loading recipe...</p>
        ) : (
          <div className="space-y-4">
            {rows.map((row, index) => {
              const selectedMaterial =
                materials.find((material) => material.rawMaterialId === row.rawMaterialId) ?? null;

              return (
                <div
                  key={index}
                  className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_200px_180px_auto]"
                >
                  <InventoryField htmlFor={`recipe-material-${index}`} label="Raw material">
                    <select
                      id={`recipe-material-${index}`}
                      value={row.rawMaterialId}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, rawMaterialId: event.target.value }
                              : item,
                          ),
                        )
                      }
                      className={inventoryInputClasses}
                    >
                      <option value="">Select raw material</option>
                      {materials.map((material) => (
                        <option key={material.rawMaterialId} value={material.rawMaterialId}>
                          {material.name} ({material.unit.code})
                        </option>
                      ))}
                    </select>
                  </InventoryField>

                  <InventoryField htmlFor={`recipe-unit-${index}`} label="Native unit">
                    <input
                      id={`recipe-unit-${index}`}
                      value={selectedMaterial ? selectedMaterial.unit.code : ""}
                      readOnly
                      className={`${inventoryInputClasses} bg-slate-50 text-slate-500`}
                      placeholder="Unit"
                    />
                  </InventoryField>

                  <InventoryField htmlFor={`recipe-qty-${index}`} label="Quantity">
                    <input
                      id={`recipe-qty-${index}`}
                      value={row.quantity}
                      onChange={(event) =>
                        setRows((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, quantity: event.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="0.0000"
                      className={inventoryInputClasses}
                    />
                  </InventoryField>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        setRows((current) =>
                          current.length === 1
                            ? [{ rawMaterialId: "", quantity: "" }]
                            : current.filter((_, itemIndex) => itemIndex !== index),
                        )
                      }
                      className="rounded-full border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setRows((current) => [...current, { rawMaterialId: "", quantity: "" }])
              }
              className="text-sm font-semibold text-[#f45a1f]"
            >
              Add ingredient
            </button>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => void handleClose()}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || loading}
            onClick={() => void handleSave()}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save Recipe"}
          </button>
        </div>
      </div>
    </InventoryModal>
  );
}
