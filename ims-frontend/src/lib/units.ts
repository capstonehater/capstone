/** Unit labels only; stored codes remain available for pricing and conversions. */
export function formatUnit(unit: string): string {
  const code = unit.trim().toLowerCase();
  if (code === "g" || code === "ml" || code === "pcs") return code;
  if (code === "bottle" || code === "water bottle" || code === "water bottles") return "pcs";
  return unit;
}

/** Format units embedded in generated recommendations, including saved forecasts. */
export function formatUnitText(text: string): string {
  return text.replace(/(\d[\d,.]*\s+)(g|ml|pcs|water bottles?|bottle)\b/gi,
    (_, quantity: string, unit: string) => `${quantity}${formatUnit(unit)}`);
}
