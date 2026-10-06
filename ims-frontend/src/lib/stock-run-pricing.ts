import { formatUnit } from "./units";
export function defaultStockRunPriceBasis(unitCode?: string | null) {
  const code = unitCode?.trim().toUpperCase() || "";
  return { costQuantity: code === "G" || code === "ML" ? "1000" : "1", costUnitCode: code };
}

export function stockRunPriceUnitOptions(unitCode?: string | null) {
  const code = unitCode?.trim().toUpperCase() || "";
  const codes = code === "G" || code === "KG" ? [code, code === "G" ? "KG" : "G"]
    : code === "ML" || code === "L" ? [code, code === "ML" ? "L" : "ML"] : [code];
  return codes.map(value => ({ value, label: formatUnit(value) || "Select material first" }));
}

export function priceQuantityInInventoryUnits(quantity: number, priceUnit: string, inventoryUnit?: string | null) {
  const base = inventoryUnit?.trim().toUpperCase();
  const price = priceUnit.trim().toUpperCase();
  if (base === price) return quantity;
  if (base === "G" && price === "KG" || base === "ML" && price === "L") return quantity * 1000;
  if (base === "KG" && price === "G" || base === "L" && price === "ML") return quantity / 1000;
  return NaN;
}
