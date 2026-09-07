export const STOCK_RUN_REASON_CODE = "RESTOCK";

export const INVENTORY_ADJUSTMENT_REASON_OPTIONS = {
  INCREASE: [
    { value: "MANUAL_RECOUNT_GAIN", label: "Manual recount gain" },
    { value: "FOUND_STOCK", label: "Found stock" },
    { value: "SUPPLIER_CORRECTION", label: "Supplier correction" },
    { value: "INTERNAL_TRANSFER_IN", label: "Internal transfer in" },
  ],
  DECREASE: [
    { value: "MANUAL_RECOUNT_LOSS", label: "Manual recount loss" },
    { value: "DAMAGED_STOCK", label: "Damaged stock" },
    { value: "INTERNAL_USE", label: "Internal use" },
    { value: "SUPPLIER_RETURN", label: "Supplier return" },
  ],
} as const;

export const INVENTORY_WASTE_REASON_OPTIONS = [
  { value: "SPOILAGE", label: "Spoilage" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CONTAMINATION", label: "Contamination" },
  { value: "PREP_LOSS", label: "Preparation loss" },
  { value: "DAMAGED_DURING_HANDLING", label: "Damaged during handling" },
] as const;

export function getDefaultAdjustmentReasonCode(
  direction: "INCREASE" | "DECREASE",
) {
  return INVENTORY_ADJUSTMENT_REASON_OPTIONS[direction][0].value;
}

export function getDefaultWasteReasonCode() {
  return INVENTORY_WASTE_REASON_OPTIONS[0].value;
}
