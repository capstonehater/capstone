import type { OrderStatus, PaymentMethod } from "@/lib/pos";

export const POS_PAYMENT_METHOD_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: "CASH", label: "Cash" },
  { value: "GCASH", label: "GCash" },
  { value: "MAYA", label: "Maya" },
  { value: "CARD", label: "Card" },
  { value: "OTHER", label: "Other" },
];

export const POS_STATUS_OPTIONS: Array<{ value: OrderStatus; label: string }> = [
  { value: "COMPLETED", label: "Completed" },
  { value: "REFUNDED", label: "Refunded" },
];

export function statusTone(status: OrderStatus) {
  switch (status) {
    case "REFUNDED":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-emerald-100 text-emerald-700";
  }
}

export function formatGrowthRate(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  const percentage = value * 100;
  const prefix = percentage > 0 ? "+" : "";
  return `${prefix}${percentage.toFixed(1)}%`;
}

export function growthTone(value: number | null) {
  if (value === null) {
    return "text-slate-500";
  }

  if (value > 0) {
    return "text-emerald-700";
  }

  if (value < 0) {
    return "text-rose-700";
  }

  return "text-slate-700";
}
