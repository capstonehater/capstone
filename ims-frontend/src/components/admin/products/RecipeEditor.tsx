"use client";

import { formatUnit } from "@/lib/units";

import StyledSelect from "@/components/admin/StyledSelect";
import { useEffect, useMemo, useState } from "react";
import styles from "./VariantsRecipe.module.css";
import modalStyles from "./VariantEditor.module.css";
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
  draftKey: string;
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
  draftKey,
  open,
  recipe,
  materials,
  loading,
  submitting,
  onClose,
  onSave,
}: Props) {
  const [rows, setRows] = useState<RecipeDraftRow[]>(() => {
    try {
      const saved = sessionStorage.getItem(draftKey);
      const draft: unknown = saved ? JSON.parse(saved) : null;
      if (Array.isArray(draft) && draft.every(row => row && typeof row.rawMaterialId === "string" && typeof row.quantity === "string")) return draft;
    } catch { /* Use the saved recipe when browser storage is unavailable. */ }
    return createDraftFromRecipe(recipe);
  });
  useEffect(() => {
    if (!open || loading) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify(rows)); } catch { /* Editing remains available without browser storage. */ }
  }, [draftKey, rows, open, loading]);
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
      } else if (!/^\d+$/.test(row.quantity) || !Number.isSafeInteger(quantityValue)) {
        nextErrors.push(`Ingredient row ${index + 1}: quantity must be a valid whole number.`);
      } else if (quantityValue <= 0) {
        nextErrors.push(`Ingredient row ${index + 1}: quantity must be greater than zero.`);
      }
    });

    setErrors(nextErrors);
    return nextErrors.length === 0;
  }

  async function handleClose() {
    onClose();
  }

  async function handleSave() {
    if (!isDirty || submitting || loading) {
      return;
    }
    if (!validate()) {
      return;
    }

    try {
      await onSave(
        rows.map((row) => ({ rawMaterialId: row.rawMaterialId, quantity: row.quantity.trim() })),
      );
      try { sessionStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "Failed to save recipe. Your draft is preserved."]);
    }
  }

  return (
    <InventoryModal
      professional
      panelClassName={modalStyles.panel}
      title={`Edit Recipe${recipe ? ` for ${recipe.variantName}` : ""}`}
      description="Recipe changes affect future sales consumption and availability calculations. Historical ingredient deductions are not rewritten."
      onClose={() => { if (!submitting) void handleClose(); }}
      wide
      bodyClassName={styles.recipeBody}
    >
      <div className={`${styles.editor} ${styles.recipeEditor}`}>
        <div className={styles.recipeScroll}>
        {errors.length > 0 ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <ul className="space-y-1">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
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
                  className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_200px_180px_auto]"
                >
                  <InventoryField htmlFor={`recipe-material-${index}`} label="Raw material" required>
                    <StyledSelect searchable aria-label="Raw material"
                      id={`recipe-material-${index}`}
                      value={row.rawMaterialId}
                      onValueChange={(value) =>
                        setRows((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, rawMaterialId: value }
                              : item,
                          ),
                        )
                      }
                      className={inventoryInputClasses}
                    >
                      <option value="">Select raw material</option>
                      {materials.map((material) => (
                        <option key={material.rawMaterialId} value={material.rawMaterialId}>
                          {material.name} ({formatUnit(material.unit.code)})
                        </option>
                      ))}
                    </StyledSelect>
                  </InventoryField>

                  <InventoryField htmlFor={`recipe-unit-${index}`} label="Native unit">
                    <input
                      id={`recipe-unit-${index}`}
                      value={selectedMaterial ? formatUnit(selectedMaterial.unit.code) : ""}
                      readOnly
                      className={`${inventoryInputClasses} bg-slate-50 text-slate-500`}
                      placeholder="Unit"
                    />
                  </InventoryField>

                  <InventoryField htmlFor={`recipe-qty-${index}`} label="Quantity" required>
                    <input
                      id={`recipe-qty-${index}`}
                      value={row.quantity}
                      onChange={(event) => {
                        const quantity = event.target.value;
                        if (!/^\d*$/.test(quantity)) return;
                        setRows((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, quantity } : item,
                          ),
                        );
                      }}
                      inputMode="numeric"
                      pattern="[0-9]+"
                      placeholder="0"
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
                      className={`${styles.danger} ${styles.removeIngredient}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

          </div>
        )}

        </div>
        <div className={styles.recipeFooter}>
          <button
            type="button"
            disabled={submitting || loading}
            onClick={() => setRows((current) => [...current, { rawMaterialId: "", quantity: "" }])}
            className={styles.secondary}
          >
            Add ingredient
          </button>
          <button
            type="button"
            disabled={submitting || loading || !isDirty}
            onClick={() => void handleSave()}
            className={`${styles.primary} ${modalStyles.primary}`}
          >
            {submitting ? "Saving..." : "Save Recipe"}
          </button>
        </div>
      </div>
    </InventoryModal>
  );
}
