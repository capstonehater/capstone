/** Unit labels only; stored codes remain available for pricing and conversions. */
export function formatUnit(unit: string): string {
  const code = unit.trim().toLowerCase();
  if (code === "g" || code === "ml") return code;
  if (code === "pc" || code === "pcs" || code === "count" || code === "bottle" || code === "water bottle" || code === "water bottles") return "pc";
  return unit;
}

/** Format units embedded in generated recommendations, including saved forecasts. */
export function formatUnitText(text: string): string {
  return text.replace(/(\d[\d,.]*\s+)(g|ml|pcs?|count|water bottles?|bottle)\b/gi,
    (_, quantity: string, unit: string) => `${quantity}${formatUnit(unit)}`);
}
