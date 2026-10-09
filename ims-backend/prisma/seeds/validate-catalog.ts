import {
  MATERIALS,
  MATERIAL_CATEGORY_BY_KEY,
  SUPPLIERS,
  VARIANTS,
} from './catalog';
import {
  generateVariantSku,
  makeMaterialSku,
} from '../../../ims-frontend/src/lib/sku-generation';

const BEVERAGE_CATEGORIES = new Set([
  'Coffee Ingredients',
  'Dairy',
  'Baking',
  'Flavorings and Sweeteners',
  'Tea and Beverage Powders',
  'Produce and Fruit',
  'Beverage Consumables',
  'Packaging',
]);
const FOOD_CATEGORIES = new Set([
  'Dairy',
  'Baking',
  'Flavorings and Sweeteners',
  'Produce and Fruit',
  'Meat and Protein',
  'Sauces and Pantry',
  'Beverage Consumables',
  'Packaging',
]);
const ALLOWED_INGREDIENT_CATEGORIES: Record<string, Set<string>> = {
  Coffee: BEVERAGE_CATEGORIES,
  'Ice-Blended Coffee': BEVERAGE_CATEGORIES,
  'Non-Coffee': BEVERAGE_CATEGORIES,
  'Ice-Blended Non-Coffee': BEVERAGE_CATEGORIES,
  Lemonade: BEVERAGE_CATEGORIES,
  Crepes: FOOD_CATEGORIES,
  Waffles: FOOD_CATEGORIES,
  Pizza: FOOD_CATEGORIES,
  Pasta: FOOD_CATEGORIES,
  'Ala Carte': FOOD_CATEGORIES,
  'All Day Breakfast': FOOD_CATEGORIES,
  Extras: FOOD_CATEGORIES,
};

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
  const generatedMaterialSkus: string[] = [];
  for (const material of MATERIALS) {
    const expectedSku = makeMaterialSku(material.name, generatedMaterialSkus);
    if (material.sku !== expectedSku || /^(CS-|RAW-|TEST-)/i.test(material.sku)) {
      throw new Error(`Raw material ${material.key} does not use the application SKU generator.`);
    }
    generatedMaterialSkus.push(expectedSku);
    if (!MATERIAL_CATEGORY_BY_KEY[material.key]) {
      throw new Error(`Raw material ${material.key} has no ingredient category.`);
    }
  }
  for (const material of MATERIALS) {
    if (!SUPPLIERS.some((supplier) => supplier.materials.includes(material.key))) {
      throw new Error(`No supplier offers ${material.key}.`);
    }
  }
  for (const variant of VARIANTS) {
    if (
      variant.sku !== generateVariantSku(variant.productName, variant.variantName) ||
      /^(CS-|RAW-|TEST-)/i.test(variant.sku)
    ) {
      throw new Error(`Variant ${variant.key} does not use the application SKU generator.`);
    }
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
      const ingredientCategory = MATERIAL_CATEGORY_BY_KEY[key];
      const allowedCategories = ALLOWED_INGREDIENT_CATEGORIES[variant.category];
      const dessertCoffeeUse =
        variant.productName === 'Caramel Mocha Waffles' && key === 'coffee';
      if (!allowedCategories?.has(ingredientCategory) && !dessertCoffeeUse) {
        throw new Error(
          `Variant ${variant.productName} (${variant.category}) cannot use ${key} (${ingredientCategory}).`,
        );
      }
    }
  }
}
