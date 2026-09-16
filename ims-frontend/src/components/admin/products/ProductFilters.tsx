"use client";

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
    <div className="grid grid-cols-3 gap-3">
      <label className="min-w-0">
        <select
          value={categoryId}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-600 outline-none focus:border-slate-500"
        >
            <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-0">
        <select
          value={manualAvailability}
          onChange={(event) =>
            onManualAvailabilityChange(event.target.value as "" | "enabled" | "disabled")
          }
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-600 outline-none focus:border-slate-500"
        >
          <option value="">All Status</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </label>

      <label className="min-w-0">
        <select
          value={effectiveAvailability}
          onChange={(event) =>
            onEffectiveAvailabilityChange(
              event.target.value as "" | ProductEffectiveStatus,
            )
          }
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-600 outline-none focus:border-slate-500"
        >
          <option value="">All Availability</option>
          {effectiveAvailabilityOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

    </div>
  );
}
