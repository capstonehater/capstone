export function generateVariantSku(productName: string, variantName: string, existingSkus: string[] = []): string {
  const words = productName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const prefix = words.map((word) => word[0]).join("").slice(0, 20);
  const suffix = variantName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 50);
  if (!prefix || !suffix) return "";
  const base = `${prefix}-${suffix}`;
  const used = new Set(existingSkus.map((sku) => sku.toUpperCase()));
  let sku = base;
  let sequence = 2;
  while (used.has(sku)) sku = `${base}-${sequence++}`;
  return sku;
}
