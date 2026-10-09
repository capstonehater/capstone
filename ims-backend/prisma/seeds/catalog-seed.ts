import {
  AccountStatus,
  ModifierSelectionMode,
  Prisma,
  PrismaClient,
  Role,
} from '@prisma/client';
import {
  MATERIALS,
  MODIFIER_GROUPS,
  MODIFIERS,
  SUPPLIERS,
  UNITS,
  VARIANTS,
} from './catalog';
import { addDays, dateOnly, manilaDateTime, stableId } from './deterministic';
import { ensureSeedProductImages, seedImageUrl } from './product-images';

export type ExistingActors = {
  administratorUserIds: string[];
  staffUserIds: string[];
};

export type CatalogIds = {
  unitIds: Map<string, string>;
  materialIds: Map<string, string>;
  supplierIds: Map<string, string>;
  productIds: Map<string, string>;
  variantIds: Map<string, string>;
  modifierGroupIds: Map<string, string>;
  modifierIds: Map<string, string>;
  administratorUserIds: string[];
  staffUserIds: string[];
  categories: Map<string, string>;
};

/** Read actor IDs without changing any user, role, permission, or auth row. */
export async function findExistingActors(prisma: PrismaClient): Promise<ExistingActors> {
  const users = await prisma.user.findMany({
    where: {
      role: { in: [Role.ADMINISTRATOR, Role.STAFF] },
      accountStatus: AccountStatus.ACTIVE,
      isActive: true,
    },
    select: { id: true, role: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const administratorUserIds = users.filter((user) => user.role === Role.ADMINISTRATOR).map((user) => user.id);
  const staffUserIds = users.filter((user) => user.role === Role.STAFF).map((user) => user.id);
  if (administratorUserIds.length === 0 || staffUserIds.length === 0) {
    throw new Error('Business reset was not started: at least one active existing ADMINISTRATOR and one active existing STAFF account are required.');
  }
  return { administratorUserIds, staffUserIds };
}

export async function seedCatalog(
  prisma: PrismaClient,
  startDate: string,
  endDateExclusive: string,
  actors: ExistingActors,
): Promise<CatalogIds> {
  const ids: CatalogIds = {
    unitIds: new Map(), materialIds: new Map(), supplierIds: new Map(),
    productIds: new Map(), variantIds: new Map(), modifierGroupIds: new Map(),
    modifierIds: new Map(), administratorUserIds: actors.administratorUserIds,
    staffUserIds: actors.staffUserIds, categories: new Map(),
  };
  const finalHistoryTime = manilaDateTime(addDays(endDateExclusive, -1), 23, 55);

  for (const unit of UNITS) {
    const saved = await prisma.unit.upsert({
      where: { code: unit.code },
      update: {},
      create: {
        id: stableId('unit', unit.code),
        code: unit.code,
        name: unit.name,
        dimension: unit.dimension,
        conversionFactor: new Prisma.Decimal(unit.conversionFactor),
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      },
    });
    if (saved.dimension !== unit.dimension || !saved.conversionFactor.equals(unit.conversionFactor)) {
      throw new Error(`Base unit ${unit.code} is incompatible with the synthetic catalog.`);
    }
    ids.unitIds.set(unit.code, saved.id);
  }

  const categoryNames = [...new Set(VARIANTS.map((variant) => variant.category))];
  for (const categoryName of categoryNames) {
    const name = categoryName;
    const category = await prisma.category.upsert({
      where: { id: stableId('category', categoryName) },
      update: {},
      create: {
        id: stableId('category', categoryName),
        name,
        sortOrder: categoryNames.indexOf(categoryName) + 1,
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      },
    });
    ids.categories.set(categoryName, category.id);
  }

  for (const supplier of SUPPLIERS) {
    const saved = await prisma.supplier.upsert({
      where: { name: supplier.name },
      update: {},
      create: {
        id: stableId('supplier', supplier.key),
        name: supplier.name,
        address: supplier.address,
        latitude: supplier.latitude === null ? null : new Prisma.Decimal(supplier.latitude),
        longitude: supplier.longitude === null ? null : new Prisma.Decimal(supplier.longitude),
        contactInfo: supplier.contactInfo,
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      },
    });
    ids.supplierIds.set(supplier.key, saved.id);
  }

  for (const material of MATERIALS) {
    const unitId = ids.unitIds.get(material.unitCode);
    if (!unitId) throw new Error(`No unit seeded for ${material.unitCode}.`);
    const saved = await prisma.rawMaterial.upsert({
      where: { sku: material.sku },
      update: {},
      create: {
        id: stableId('raw-material', material.key),
        unitId,
        name: material.name,
        sku: material.sku,
        reorderPoint: new Prisma.Decimal(material.reorderPoint),
        isActive: material.isActive ?? true,
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      },
    });
    ids.materialIds.set(material.key, saved.id);
  }

  const variantsByProduct = new Map<string, typeof VARIANTS>();
  for (const variant of VARIANTS) {
    const key = `${variant.category}:${variant.productName}`;
    const variants = variantsByProduct.get(key) ?? [];
    variants.push(variant);
    variantsByProduct.set(key, variants);
  }
  await ensureSeedProductImages(
    [...variantsByProduct.values()].map((variants) => ({
      category: variants[0].category,
      name: variants[0].productName,
    })),
  );
  for (const [key, variants] of variantsByProduct) {
    const [categoryName, productName] = key.split(':');
    const categoryId = ids.categories.get(categoryName);
    if (!categoryId) throw new Error(`Missing menu category ${categoryName}.`);
    const product = await prisma.product.upsert({
      where: { categoryId_name: { categoryId, name: productName } },
      update: {},
      create: {
        id: stableId('product', key),
        categoryId,
        name: productName,
        imageUrl: seedImageUrl(categoryName, productName),
        isEnabled: true,
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      },
    });
    ids.productIds.set(key, product.id);
    for (const variant of variants) {
      const savedVariant = await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: {},
        create: {
          id: stableId('product-variant', variant.key),
          productId: product.id,
          name: variant.variantName,
          price: new Prisma.Decimal(variant.basePrice),
          sku: variant.sku,
          isEnabled: true,
          createdAt: dateOnly(startDate),
          updatedAt: finalHistoryTime,
        },
      });
      ids.variantIds.set(variant.key, savedVariant.id);
    }
  }

  for (const group of MODIFIER_GROUPS) {
    const saved = await prisma.modifierGroup.upsert({
      where: { name: group.name },
      update: {},
      create: {
        id: stableId('modifier-group', group.key),
        name: group.name,
        selectionMode: group.selectionMode as ModifierSelectionMode,
        defaultMinSelect: group.defaultMinSelect,
        defaultMaxSelect: group.defaultMaxSelect,
        isActive: true,
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      },
    });
    ids.modifierGroupIds.set(group.key, saved.id);
  }

  for (const modifier of MODIFIERS) {
    const modifierGroupId = ids.modifierGroupIds.get(modifier.groupKey);
    if (!modifierGroupId) throw new Error(`Missing modifier group ${modifier.groupKey}.`);
    const saved = await prisma.modifier.upsert({
      where: { modifierGroupId_name: { modifierGroupId, name: modifier.name } },
      update: {},
      create: {
        id: stableId('modifier', modifier.key),
        modifierGroupId,
        name: modifier.name,
        priceAdjustment: new Prisma.Decimal(modifier.priceAdjustment),
        isActive: true,
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      },
    });
    ids.modifierIds.set(modifier.key, saved.id);
  }

  const recipeRows: Prisma.VariantRecipeItemCreateManyInput[] = [];
  for (const variant of VARIANTS) {
    const productVariantId = ids.variantIds.get(variant.key)!;
    for (const [materialKey, quantity] of Object.entries(variant.recipe)) {
      const rawMaterialId = ids.materialIds.get(materialKey);
      if (!rawMaterialId) throw new Error(`Recipe ${variant.key} references unknown material ${materialKey}.`);
      recipeRows.push({
        id: stableId('recipe', `${variant.key}:${materialKey}`),
        productVariantId,
        rawMaterialId,
        quantity: new Prisma.Decimal(quantity),
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      });
    }
  }
  await insertRows(recipeRows, (data) => prisma.variantRecipeItem.createMany({ data }));

  const adjustmentRows: Prisma.ModifierRecipeAdjustmentCreateManyInput[] = [];
  for (const modifier of MODIFIERS) {
    const modifierId = ids.modifierIds.get(modifier.key)!;
    for (const [materialKey, quantityDelta] of Object.entries(modifier.recipeAdjustments)) {
      const rawMaterialId = ids.materialIds.get(materialKey);
      if (!rawMaterialId) throw new Error(`Modifier ${modifier.key} references unknown material ${materialKey}.`);
      adjustmentRows.push({
        id: stableId('modifier-recipe-adjustment', `${modifier.key}:${materialKey}`),
        modifierId,
        rawMaterialId,
        quantityDelta: new Prisma.Decimal(quantityDelta),
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      });
    }
  }
  await insertRows(adjustmentRows, (data) => prisma.modifierRecipeAdjustment.createMany({ data }));

  const productModifierGroups: Prisma.ProductModifierGroupCreateManyInput[] = [];
  for (const [key, variants] of variantsByProduct) {
    const [categoryName, productName] = key.split(':');
    const productId = ids.productIds.get(key)!;
    const groupKeys = new Set<string>();
    if (variants.some((variant) => variant.recipe.whole_milk === 145)) groupKeys.add('milk-choice');
    if (variants.some((variant) => variant.recipe.coffee !== undefined)) groupKeys.add('espresso-extra');
    let sortOrder = 0;
    for (const groupKey of groupKeys) {
      productModifierGroups.push({
        id: stableId('product-modifier-group', `${categoryName}:${productName}:${groupKey}`),
        productId,
        modifierGroupId: ids.modifierGroupIds.get(groupKey)!,
        minSelect: 0,
        maxSelect: 1,
        isRequired: false,
        allowQuantity: false,
        sortOrder: sortOrder++,
        createdAt: dateOnly(startDate),
        updatedAt: finalHistoryTime,
      });
    }
  }
  await insertRows(productModifierGroups, (data) => prisma.productModifierGroup.createMany({ data }));

  return ids;
}

async function insertRows<T>(rows: T[], insert: (data: T[]) => Promise<unknown>) {
  const chunkSize = 500;
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    await insert(rows.slice(offset, offset + chunkSize));
  }
}
