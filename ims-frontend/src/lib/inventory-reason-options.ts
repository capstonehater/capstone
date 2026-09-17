export const STOCK_RUN_REASON_CODE = "RESTOCK";

export const INVENTORY_WASTE_REASON_OPTIONS = [
  { value: "SPOILAGE", label: "Spoilage" },
  { value: "EXPIRED", label: "Expired" },
  { value: "CONTAMINATION", label: "Contamination" },
  { value: "PREP_LOSS", label: "Preparation loss" },
  { value: "DAMAGED_DURING_HANDLING", label: "Damaged during handling" },
] as const;

export function getDefaultWasteReasonCode() {
  return INVENTORY_WASTE_REASON_OPTIONS[0].value;
}
