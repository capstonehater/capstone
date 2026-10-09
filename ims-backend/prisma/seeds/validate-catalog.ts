import { MATERIALS, SUPPLIERS, VARIANTS } from './catalog';

export function validateSeedCatalog(): void {
  const assertUnique = (label: string, values: string[]) => {
    const duplicate = values.find((value, index) => values.indexOf(value) !== index);
    if (duplicate) throw new Error(`Duplicate ${label}: ${duplicate}`);
  };
  assertUnique('material SKU', MATERIALS.map((material) => material.sku));
  assertUnique('material key', MATERIALS.map((material) => material.key));
  assertUnique('variant SKU', VARIANTS.map((variant) => variant.sku));
  assertUnique('variant key', VARIANTS.map((variant) => variant.key));
  assertUnique('supplier name', SUPPLIERS.map((supplier) => supplier.name));
  const materialKeys = new Set(MATERIALS.map((material) => material.key));
  for (const material of MATERIALS) {
    if (!SUPPLIERS.some((supplier) => supplier.materials.includes(material.key))) {
      throw new Error(`No supplier offers ${material.key}.`);
    }
  }
  for (const variant of VARIANTS) {
    if (!variant.recipe || Object.keys(variant.recipe).length === 0) {
      throw new Error(`Variant ${variant.sku} has no recipe.`);
    }
    if (!Number.isFinite(variant.basePrice) || variant.basePrice <= 0) {
      throw new Error(`Variant ${variant.sku} has an invalid menu price.`);
    }
    for (const [key, quantity] of Object.entries(variant.recipe)) {
      if (!materialKeys.has(key) || !Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`Variant ${variant.sku} has an invalid recipe entry for ${key}.`);
      }
    }
  }
}
