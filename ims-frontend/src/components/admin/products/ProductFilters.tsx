"use client";

import AdminSelect from "@/components/admin/AdminSelect";

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
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <AdminSelect label="Category" value={categoryId} onChange={onCategoryChange}
        options={[{ value: "", label: "All Categories" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} />
      <AdminSelect label="Status" value={manualAvailability}
        onChange={(value) => onManualAvailabilityChange(value as "" | "enabled" | "disabled")}
        options={[{ value: "", label: "All Status" }, { value: "enabled", label: "Enabled" }, { value: "disabled", label: "Disabled" }]} />
      <AdminSelect label="Availability" value={effectiveAvailability}
        onChange={(value) => onEffectiveAvailabilityChange(value as "" | ProductEffectiveStatus)}
        options={[{ value: "", label: "All Availability" }, ...effectiveAvailabilityOptions]} />
    </div>
  );
}
