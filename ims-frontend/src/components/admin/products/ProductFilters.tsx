"use client";

import { inventoryInputClasses } from "@/components/admin/inventory/InventoryField";
import type { ProductCategory, ProductEffectiveStatus } from "@/lib/products";

type Props = {
  categories: ProductCategory[];
  categoryId: string;
  manualAvailability: "" | "enabled" | "disabled";
  effectiveAvailability: "" | ProductEffectiveStatus;
  onCategoryChange: (value: string) => void;
  onManualAvailabilityChange: (value: "" | "enabled" | "disabled") => void;
  onEffectiveAvailabilityChange: (value: "" | ProductEffectiveStatus) => void;
  onClearFilters: () => void;
};

const effectiveAvailabilityOptions: Array<{
  value: ProductEffectiveStatus;
  label: string;
}> = [
  { value: "SELLABLE", label: "Sellable" },
  { value: "PARTIALLY_AVAILABLE", label: "Partially Available" },
  { value: "MANUALLY_DISABLED", label: "Manually Disabled" },
  { value: "OUT_OF_STOCK", label: "Out of Stock" },
  { value: "NO_VALID_RECIPE", label: "No Valid Recipe" },
  { value: "NO_SELLABLE_VARIANT", label: "No Sellable Variant" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "UNKNOWN", label: "Unknown" },
];

export default function ProductFilters({
  categories,
  categoryId,
  manualAvailability,
  effectiveAvailability,
  onCategoryChange,
  onManualAvailabilityChange,
  onEffectiveAvailabilityChange,
  onClearFilters,
}: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm font-medium text-slate-700">
        <span>Category</span>
        <select
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
          className={inventoryInputClasses}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-sm font-medium text-slate-700">
        <span>Manual availability</span>
        <select
          value={manualAvailability}
          onChange={(event) =>
            onManualAvailabilityChange(event.target.value as "" | "enabled" | "disabled")
          }
          className={inventoryInputClasses}
        >
          <option value="">All</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>

      <label className="space-y-1 text-sm font-medium text-slate-700 sm:col-span-2">
        <span>Effective availability</span>
        <select
          value={effectiveAvailability}
          onChange={(event) =>
            onEffectiveAvailabilityChange(
              event.target.value as "" | ProductEffectiveStatus,
            )
          }
          className={inventoryInputClasses}
        >
          <option value="">All statuses</option>
          {effectiveAvailabilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="sm:col-span-2">
        <button
          type="button"
          onClick={onClearFilters}
          className="text-sm font-semibold text-[#f45a1f] transition hover:text-[#d94f1a]"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}

