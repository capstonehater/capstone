import type { VariantFormInput } from "./types";

export function productFormErrors(name: string, categoryId: string, categoryIds: string[], variants: VariantFormInput[], creating: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = "Product name is required.";
  if (!categoryIds.includes(categoryId)) errors.categoryId = "Select a category.";
  if (!creating) return errors;
  if (!variants.length) errors.initialVariants = "Add at least one variant.";
  const names = new Set<string>();
  const skus = new Set<string>();
  variants.forEach((variant, index) => {
    const prefix = `initialVariants.${index}`;
    const variantName = variant.name.trim().toLowerCase();
    const sku = variant.sku.trim().toLowerCase();
    if (!variantName) errors[`${prefix}.name`] = "Variant name is required.";
    else if (names.has(variantName)) errors[`${prefix}.name`] = "Use a unique variant name.";
    names.add(variantName);
    if (sku && skus.has(sku)) errors[`${prefix}.name`] = "This name generates a duplicate SKU. Use a different variant name.";
    if (sku) skus.add(sku);
    if (!variant.price.trim()) errors[`${prefix}.price`] = "Price is required.";
    else if (!/^\d+$/.test(variant.price) || !Number.isSafeInteger(Number(variant.price))) {
      errors[`${prefix}.price`] = "Enter a valid non-negative whole number.";
    }
  });
  return errors;
}
