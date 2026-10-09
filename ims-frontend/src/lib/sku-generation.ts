/** Shared SKU generators used by the product and inventory UI and data repair tools. */
export function makeMaterialSku(name: string, existingSkus: string[]): string {
  const words = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];
  const stem = words.length > 1
    ? words.map((word) => word[0]).join("")
    : (words[0] ?? "MAT").slice(0, 4);
  const prefix = `RM-${stem || "MAT"}-`;
  const used = new Set(existingSkus.map((sku) => sku.toUpperCase()));
  let sequence = 1;
  while (used.has(`${prefix}${String(sequence).padStart(3, "0")}`)) sequence += 1;
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

export function generateVariantSku(productName: string, variantName: string): string {
  const words = productName.toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  const normalizedProductName = productName.trim().toUpperCase().replace(/\s+/g, " ");
  const prefix = normalizedProductName === "PEPPERMINT MOCHA"
    ? "PMC"
    : words.map((word) => word[0]).join("");
  const suffix = variantName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return prefix && suffix ? `${prefix}-${suffix}` : "";
}
