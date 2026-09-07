"use client";

import type {
  ProductArchiveState,
  ProductEffectiveStatus,
  ProductManualAvailability,
  ProductQualityWarningTone,
  ProductStockAvailability,
} from "@/lib/products";

export function formatPeso(value: string | number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "N/A";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "N/A";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function effectiveStatusBadgeClasses(status: ProductEffectiveStatus) {
  switch (status) {
    case "SELLABLE":
      return "bg-emerald-100 text-emerald-800";
    case "PARTIALLY_AVAILABLE":
      return "bg-amber-100 text-amber-800";
    case "MANUALLY_DISABLED":
      return "bg-slate-200 text-slate-800";
    case "OUT_OF_STOCK":
    case "NO_VALID_RECIPE":
    case "NO_SELLABLE_VARIANT":
      return "bg-rose-100 text-rose-800";
    case "ARCHIVED":
      return "bg-neutral-200 text-neutral-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function manualAvailabilityBadgeClasses(
  availability: ProductManualAvailability,
) {
  return availability === "ENABLED"
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

export function stockAvailabilityBadgeClasses(
  availability: ProductStockAvailability,
) {
  switch (availability) {
    case "AVAILABLE":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "PARTIAL":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "UNAVAILABLE":
      return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
    default:
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  }
}

export function archiveStateBadgeClasses(state: ProductArchiveState) {
  return state === "ARCHIVED"
    ? "bg-neutral-200 text-neutral-800"
    : "bg-sky-100 text-sky-800";
}

export function warningToneClasses(tone: ProductQualityWarningTone) {
  switch (tone) {
    case "critical":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function summarizeAvailabilityLabel(
  availability: ProductManualAvailability,
) {
  return availability === "ENABLED" ? "Enabled" : "Disabled";
}

