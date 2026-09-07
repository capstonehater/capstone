"use client";

import { useState } from "react";
import type { InventorySummaryItem } from "@/lib/inventory";
import type { ProductDetail, ProductRecipe, ProductVariantDetail } from "@/lib/products";
import RecipeEditor from "./RecipeEditor";
import {
  formatPeso,
  manualAvailabilityBadgeClasses,
  stockAvailabilityBadgeClasses,
} from "./product-ui";

type Props = {
  product: ProductDetail;
  selectedVariantId: string | null;
  recipe: ProductRecipe | null;
  recipeLoading: boolean;
  recipeError?: string | null;
  submitting: boolean;
  materials: InventorySummaryItem[];
  onSelectVariant: (variantId: string) => void;
  onAddVariant: () => void;
  onEditVariant: (variant: ProductVariantDetail) => void;
  onToggleVariant: (variant: ProductVariantDetail) => void;
  onDeleteVariant: (variant: ProductVariantDetail) => void;
  onSaveRecipe: (items: Array<{ rawMaterialId: string; quantity: string }>) => Promise<void>;
};

export default function ProductVariantsRecipeTab({
  product,
  selectedVariantId,
  recipe,
  recipeLoading,
  recipeError,
  submitting,
  materials,
  onSelectVariant,
  onAddVariant,
  onEditVariant,
  onToggleVariant,
  onDeleteVariant,
  onSaveRecipe,
}: Props) {
  const [recipeEditorOpen, setRecipeEditorOpen] = useState(false);
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ?? null;

  function variantStockLabel(variant: ProductVariantDetail) {
    if (variant.isInStock) {
      return "In Stock";
    }

    if (variant.availableBaseQty > 0) {
      return "Partial";
    }

    return "Out of Stock";
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Variants & Recipe</h3>
          <p className="mt-1 text-sm text-slate-500">
            Select a variant to view recipe coverage, stock state, and sellability separately.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddVariant}
          className="rounded-full bg-[#f45a1f] px-4 py-2 text-sm font-semibold text-white"
        >
          Add Variant
        </button>
      </div>

      <div className="space-y-3">
        {product.variants.map((variant) => {
          const selected = variant.id === selectedVariantId;
          const stockLabel = variantStockLabel(variant);

          return (
            <div
              key={variant.id}
              className={`rounded-3xl border p-4 transition ${
                selected ? "border-[#f45a1f] bg-[#fff4ef]" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectVariant(variant.id)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      selected ? "bg-[#f45a1f] text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {selected ? "Selected" : "Select variant"}
                  </button>
                  <h4 className="mt-3 text-base font-semibold text-slate-900">{variant.name}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    SKU {variant.sku} · {formatPeso(variant.price)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${manualAvailabilityBadgeClasses(variant.manualAvailability)}`}
                    >
                      Manual: {variant.manualAvailability === "ENABLED" ? "Enabled" : "Disabled"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${stockAvailabilityBadgeClasses(
                        variant.isInStock ? "AVAILABLE" : variant.availableBaseQty > 0 ? "PARTIAL" : "UNAVAILABLE",
                      )}`}
                    >
                      Stock: {stockLabel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Effective: {variant.isSellable ? "Sellable" : "Unavailable"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {variant.ingredientCount} ingredients
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Blocking reason: {variant.blockingReason || "None"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onEditVariant(variant)}
                    disabled={submitting}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleVariant(variant)}
                    disabled={submitting}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
                  >
                    {variant.manualAvailability === "ENABLED" ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteVariant(variant)}
                    disabled={submitting}
                    className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedVariant ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h4 className="text-base font-semibold text-slate-900">
                Recipe for {selectedVariant.name}
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                View the current ingredient list and open the dedicated editor when changes are
                needed.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRecipeEditorOpen(true)}
              disabled={submitting}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Edit Recipe
            </button>
          </div>

          {recipeLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading recipe...</p>
          ) : recipeError ? (
            <div className="mt-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              {recipeError}
            </div>
          ) : !recipe || recipe.items.length === 0 ? (
            <div className="mt-4 rounded-3xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
              This variant does not have a recipe yet.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-white">
                  <tr className="text-left text-slate-500">
                    <th className="px-4 py-3 font-semibold">Ingredient</th>
                    <th className="px-4 py-3 font-semibold">Quantity</th>
                    <th className="px-4 py-3 font-semibold">Unit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-slate-50/40">
                  {recipe.items.map((item) => (
                    <tr key={item.rawMaterialId}>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {item.rawMaterialName}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-3 text-slate-700">{item.unit.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          Select a variant to view or edit its recipe.
        </div>
      )}

      <RecipeEditor
        key={`${selectedVariant?.id ?? "none"}:${recipeEditorOpen ? "open" : "closed"}`}
        open={recipeEditorOpen}
        recipe={recipe}
        materials={materials}
        loading={recipeLoading}
        submitting={submitting}
        onClose={() => setRecipeEditorOpen(false)}
        onSave={async (items) => {
          await onSaveRecipe(items);
          setRecipeEditorOpen(false);
        }}
      />
    </div>
  );
}
