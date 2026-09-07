import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  AccountStatus,
  AvailabilityBlockingReason,
  ModifierSelectionMode,
  OrderStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  Role,
  StockRunStatus,
  UnitDimension,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

type CsvRow = Record<string, string>;
type LegacyIdMap = Map<string, string>;

const prisma = new PrismaClient();

const ZIP_FILE_NAME = 'cafe_seed_csv_bundle.zip';
const FLAT_FILE_NAME = 'cafe_menu_variants_flat.csv';

function resolveSeedPaths() {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  return {
    bundlePath:
      process.env.CAFE_SEED_BUNDLE_PATH ??
      path.join(downloadsDir, ZIP_FILE_NAME),
    flatPath:
      process.env.CAFE_MENU_FLAT_PATH ??
      path.join(downloadsDir, FLAT_FILE_NAME),
  };
}

function ensureFileExists(filePath: string) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required seed file not found: ${filePath}`);
  }
}

function parseCsv(filePath: string): CsvRow[] {
  const text = fs.readFileSync(filePath, 'utf8').trim();
  if (!text) {
    return [];
  }

  const rows: string[][] = [];
  let current = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        index += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  row.push(current);
  rows.push(row);

  const [headers, ...dataRows] = rows;
  return dataRows
    .filter((dataRow) => dataRow.some((value) => value.trim().length > 0))
    .map((dataRow) =>
      headers.reduce<CsvRow>((result, header, headerIndex) => {
        result[header] = (dataRow[headerIndex] ?? '').trim();
        return result;
      }, {}),
    );
}

function parseBoolean(value: string, fallback = false): boolean {
  if (!value) {
    return fallback;
  }

  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

function parseDecimal(value: string, fallback = '0'): Prisma.Decimal {
  return new Prisma.Decimal(value || fallback);
}

function parseDateTime(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(value);
}

function parseDateOnly(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  return new Date(`${value}T00:00:00.000Z`);
}

function parseCoordinates(value: string | undefined) {
  if (!value) {
    return { latitude: null, longitude: null };
  }

  const [latitude, longitude] = value.split(',').map((item) => item.trim());
  return {
    latitude: latitude ? parseDecimal(latitude) : null,
    longitude: longitude ? parseDecimal(longitude) : null,
  };
}

function inferUnitDimension(code: string): UnitDimension {
  switch (code.toLowerCase()) {
    case 'g':
    case 'kg':
      return UnitDimension.MASS;
    case 'ml':
    case 'l':
      return UnitDimension.VOLUME;
    case 'pcs':
      return UnitDimension.COUNT;
    case 'pack':
    case 'bottle':
    case 'can':
      return UnitDimension.PACKAGE;
    default:
      throw new Error(`Unsupported unit code in seed import: ${code}`);
  }
}

function inferModifierGroupDefaults(name: string) {
  const normalized = name.toLowerCase();

  if (
    normalized.includes('flavor') ||
    normalized.includes('option') ||
    normalized.includes('sweetener') ||
    normalized.includes('ice level')
  ) {
    return {
      selectionMode: ModifierSelectionMode.SINGLE,
      minSelect: 1,
      maxSelect: 1,
      isRequired: true,
      allowQuantity: false,
    };
  }

  return {
    selectionMode: ModifierSelectionMode.MULTIPLE,
    minSelect: 0,
    maxSelect: 5,
    isRequired: false,
    allowQuantity: true,
  };
}

function extractBundle(bundlePath: string): string {
  const destination = path.join(process.cwd(), '.seed-cache', 'bundle');
  fs.mkdirSync(destination, { recursive: true });

  execFileSync('powershell', [
    '-NoLogo',
    '-NoProfile',
    '-Command',
    `Expand-Archive -LiteralPath '${bundlePath.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`,
  ]);

  return destination;
}

async function seedUsers() {
  const passwordSaltRounds = 12;
  const now = new Date();

  const users = [
    {
      email: 'admin@stockscout.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      role: Role.ADMINISTRATOR,
      password: 'admin123',
    },
    {
      email: 'sysadmin@stockscout.com',
      username: 'sysadmin',
      firstName: 'System',
      lastName: 'Admin',
      role: Role.ADMINISTRATOR,
      password: 'sysadmin123',
    },
    {
      email: 'staff@stockscout.com',
      username: 'staff',
      firstName: 'Staff',
      lastName: 'User',
      role: Role.STAFF,
      password: 'staff123',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        username: user.username,
        passwordHash: await bcrypt.hash(user.password, passwordSaltRounds),
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accountStatus: AccountStatus.ACTIVE,
        isActive: true,
        emailVerifiedAt: now,
        passwordChangedAt: now,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      create: {
        username: user.username,
        email: user.email,
        passwordHash: await bcrypt.hash(user.password, passwordSaltRounds),
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        accountStatus: AccountStatus.ACTIVE,
        isActive: true,
        emailVerifiedAt: now,
        passwordChangedAt: now,
      },
    });
  }
}

async function main() {
  const { bundlePath, flatPath } = resolveSeedPaths();
  ensureFileExists(bundlePath);
  ensureFileExists(flatPath);

  await seedUsers();

  const extractedDir = extractBundle(bundlePath);
  const readBundle = (fileName: string) =>
    parseCsv(path.join(extractedDir, fileName));

  const flatRows = parseCsv(flatPath);
  const categoryRows = readBundle('categories.csv');
  const productRows = readBundle('products.csv');
  const productVariantRows = readBundle('product_variants.csv');
  const modifierGroupRows = readBundle('modifier_groups.csv');
  const modifierRows = readBundle('modifiers.csv');
  const productModifierRows = readBundle('product_modifier_mapping.csv');
  const unitRows = readBundle('units.csv');
  const rawMaterialRows = readBundle('raw_materials.csv');
  const recipeRows = readBundle('product_recipes.csv');
  const supplierRows = readBundle('suppliers.csv');
  const stockRunRows = readBundle('stock_runs.csv');
  const stockRunItemRows = readBundle('stock_run_items.csv');
  const stockBatchRows = readBundle('stock_batches.csv');
  const orderRows = readBundle('orders.csv');
  const orderItemRows = readBundle('order_items.csv');
  const orderItemModifierRows = readBundle('order_item_modifiers.csv');
  const stockMovementRows = readBundle('stock_movements.csv');

  const categoryIdMap: LegacyIdMap = new Map();
  const productIdMap: LegacyIdMap = new Map();
  const productVariantIdMap: LegacyIdMap = new Map();
  const modifierGroupIdMap: LegacyIdMap = new Map();
  const modifierIdMap: LegacyIdMap = new Map();
  const unitIdMap: LegacyIdMap = new Map();
  const rawMaterialIdMap: LegacyIdMap = new Map();
  const supplierIdMap: LegacyIdMap = new Map();
  const stockRunIdMap: LegacyIdMap = new Map();
  const stockRunItemIdMap: LegacyIdMap = new Map();
  const stockBatchIdMap: LegacyIdMap = new Map();
  const orderIdMap: LegacyIdMap = new Map();
  const orderItemIdMap: LegacyIdMap = new Map();

  const duplicateVariantSkus = new Set<string>();
  const seenVariantSkus = new Set<string>();
  for (const row of productVariantRows) {
    if (seenVariantSkus.has(row.sku)) {
      duplicateVariantSkus.add(row.sku);
    }
    seenVariantSkus.add(row.sku);
  }

  if (duplicateVariantSkus.size > 0) {
    throw new Error(
      `Duplicate variant SKU(s) detected in seed bundle: ${[...duplicateVariantSkus].join(', ')}`,
    );
  }

  const categoryRowsById = new Map(categoryRows.map((row) => [row.id, row]));
  const modifierGroupRowsById = new Map(
    modifierGroupRows.map((row) => [row.id, row]),
  );

  for (const unitRow of unitRows) {
    if (parseDecimal(unitRow.conversion_factor).lessThanOrEqualTo(0)) {
      throw new Error(`Unit ${unitRow.name} has invalid conversion factor`);
    }

    const unit = await prisma.unit.upsert({
      where: { name: unitRow.name },
      update: {
        code: unitRow.name.toUpperCase(),
        dimension: inferUnitDimension(unitRow.name),
        conversionFactor: parseDecimal(unitRow.conversion_factor),
      },
      create: {
        code: unitRow.name.toUpperCase(),
        name: unitRow.name,
        dimension: inferUnitDimension(unitRow.name),
        conversionFactor: parseDecimal(unitRow.conversion_factor),
      },
    });

    unitIdMap.set(unitRow.id, unit.id);
  }

  async function upsertCategory(row: CsvRow): Promise<string> {
    if (categoryIdMap.has(row.id)) {
      return categoryIdMap.get(row.id)!;
    }

    let parentId: string | undefined;
    if (row.parent_id) {
      const parentRow = categoryRowsById.get(row.parent_id);
      if (!parentRow) {
        throw new Error(
          `Category ${row.id} references missing parent ${row.parent_id}`,
        );
      }
      parentId = await upsertCategory(parentRow);
    }

    const existing = await prisma.category.findFirst({
      where: {
        name: row.name,
        parentId: parentId ?? null,
      },
      select: { id: true },
    });

    const category = existing
      ? await prisma.category.update({
          where: { id: existing.id },
          data: { name: row.name },
        })
      : await prisma.category.create({
          data: {
            name: row.name,
            parentId: parentId ?? null,
            createdAt: parseDateTime(row.created_at) ?? new Date(),
          },
        });

    categoryIdMap.set(row.id, category.id);
    return category.id;
  }

  for (const row of categoryRows) {
    await upsertCategory(row);
  }

  for (const supplierRow of supplierRows) {
    const coordinates = parseCoordinates(supplierRow.coordinates);
    const supplier = await prisma.supplier.upsert({
      where: { name: supplierRow.name },
      update: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address: supplierRow.address || null,
        contactInfo: supplierRow.contact_info || null,
      },
      create: {
        name: supplierRow.name,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        address: supplierRow.address || null,
        contactInfo: supplierRow.contact_info || null,
      },
    });

    supplierIdMap.set(supplierRow.id, supplier.id);
  }

  for (const rawMaterialRow of rawMaterialRows) {
    const unitId = unitIdMap.get(rawMaterialRow.unit_id);
    if (!unitId) {
      throw new Error(
        `Raw material ${rawMaterialRow.name} references missing unit ${rawMaterialRow.unit_id}`,
      );
    }

    const rawMaterial = await prisma.rawMaterial.upsert({
      where: { sku: rawMaterialRow.sku },
      update: {
        name: rawMaterialRow.name,
        unitId,
      },
      create: {
        name: rawMaterialRow.name,
        unitId,
        sku: rawMaterialRow.sku,
        createdAt: parseDateTime(rawMaterialRow.created_at) ?? new Date(),
        updatedAt: parseDateTime(rawMaterialRow.updated_at) ?? new Date(),
      },
    });

    rawMaterialIdMap.set(rawMaterialRow.id, rawMaterial.id);
  }

  for (const modifierGroupRow of modifierGroupRows) {
    const defaults = inferModifierGroupDefaults(modifierGroupRow.name);
    const modifierGroup = await prisma.modifierGroup.upsert({
      where: { name: modifierGroupRow.name },
      update: {
        selectionMode: defaults.selectionMode,
        defaultMinSelect: defaults.minSelect,
        defaultMaxSelect: defaults.maxSelect,
      },
      create: {
        name: modifierGroupRow.name,
        selectionMode: defaults.selectionMode,
        defaultMinSelect: defaults.minSelect,
        defaultMaxSelect: defaults.maxSelect,
      },
    });

    modifierGroupIdMap.set(modifierGroupRow.id, modifierGroup.id);
  }

  for (const modifierRow of modifierRows) {
    const modifierGroupId = modifierGroupIdMap.get(modifierRow.group_id);
    if (!modifierGroupId) {
      throw new Error(
        `Modifier ${modifierRow.name} references missing modifier group ${modifierRow.group_id}`,
      );
    }

    const existing = await prisma.modifier.findFirst({
      where: { modifierGroupId, name: modifierRow.name },
      select: { id: true },
    });

    const modifier = existing
      ? await prisma.modifier.update({
          where: { id: existing.id },
          data: {
            priceAdjustment: parseDecimal(modifierRow.price_adjustment),
          },
        })
      : await prisma.modifier.create({
          data: {
            modifierGroupId,
            name: modifierRow.name,
            priceAdjustment: parseDecimal(modifierRow.price_adjustment),
          },
        });

    modifierIdMap.set(modifierRow.id, modifier.id);
  }

  for (const productRow of productRows) {
    const categoryId = categoryIdMap.get(productRow.category_id);
    if (!categoryId) {
      throw new Error(
        `Product ${productRow.name} references missing category ${productRow.category_id}`,
      );
    }

    const existing = await prisma.product.findFirst({
      where: { categoryId, name: productRow.name },
      select: { id: true },
    });

    const product = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            isEnabled: parseBoolean(productRow.is_enabled, true),
          },
        })
      : await prisma.product.create({
          data: {
            categoryId,
            name: productRow.name,
            isEnabled: parseBoolean(productRow.is_enabled, true),
            createdAt: parseDateTime(productRow.created_at) ?? new Date(),
            updatedAt: parseDateTime(productRow.updated_at) ?? new Date(),
          },
        });

    productIdMap.set(productRow.id, product.id);
  }

  for (const productVariantRow of productVariantRows) {
    const productId = productIdMap.get(productVariantRow.product_id);
    if (!productId) {
      throw new Error(
        `Product variant ${productVariantRow.sku} references missing product ${productVariantRow.product_id}`,
      );
    }

    const variant = await prisma.productVariant.upsert({
      where: { sku: productVariantRow.sku },
      update: {
        productId,
        name: productVariantRow.name,
        price: parseDecimal(productVariantRow.price),
      },
      create: {
        productId,
        name: productVariantRow.name,
        price: parseDecimal(productVariantRow.price),
        sku: productVariantRow.sku,
        createdAt: parseDateTime(productVariantRow.created_at) ?? new Date(),
        updatedAt: parseDateTime(productVariantRow.updated_at) ?? new Date(),
      },
    });

    productVariantIdMap.set(productVariantRow.id, variant.id);
  }

  for (const mappingRow of productModifierRows) {
    const productId = productIdMap.get(mappingRow.product_id);
    const modifierGroupId = modifierGroupIdMap.get(
      mappingRow.modifier_group_id,
    );
    if (!productId || !modifierGroupId) {
      throw new Error(
        `Invalid product/modifier group mapping ${JSON.stringify(mappingRow)}`,
      );
    }

    const defaults = inferModifierGroupDefaults(
      modifierGroupRowsById.get(mappingRow.modifier_group_id)?.name ?? '',
    );

    const existing = await prisma.productModifierGroup.findFirst({
      where: { productId, modifierGroupId },
      select: { id: true },
    });

    if (existing) {
      await prisma.productModifierGroup.update({
        where: { id: existing.id },
        data: {
          minSelect: defaults.minSelect,
          maxSelect: defaults.maxSelect,
          isRequired: defaults.isRequired,
          allowQuantity: defaults.allowQuantity,
        },
      });
    } else {
      await prisma.productModifierGroup.create({
        data: {
          productId,
          modifierGroupId,
          minSelect: defaults.minSelect,
          maxSelect: defaults.maxSelect,
          isRequired: defaults.isRequired,
          allowQuantity: defaults.allowQuantity,
        },
      });
    }
  }

  for (const recipeRow of recipeRows) {
    const productVariantId = productVariantIdMap.get(
      recipeRow.product_variant_id,
    );
    const rawMaterialId = rawMaterialIdMap.get(recipeRow.raw_material_id);
    if (!productVariantId || !rawMaterialId) {
      throw new Error(`Invalid recipe row ${JSON.stringify(recipeRow)}`);
    }

    if (parseDecimal(recipeRow.quantity_used).lessThanOrEqualTo(0)) {
      throw new Error(
        `Recipe quantity must be positive for row ${JSON.stringify(recipeRow)}`,
      );
    }

    const existing = await prisma.variantRecipeItem.findFirst({
      where: { productVariantId, rawMaterialId },
      select: { id: true },
    });

    if (existing) {
      await prisma.variantRecipeItem.update({
        where: { id: existing.id },
        data: {
          quantity: parseDecimal(recipeRow.quantity_used),
        },
      });
    } else {
      await prisma.variantRecipeItem.create({
        data: {
          productVariantId,
          rawMaterialId,
          quantity: parseDecimal(recipeRow.quantity_used),
        },
      });
    }
  }

  const variantsWithRecipes = new Set(
    recipeRows
      .map((row) => productVariantIdMap.get(row.product_variant_id))
      .filter(Boolean) as string[],
  );
  for (const row of productVariantRows) {
    const variantId = productVariantIdMap.get(row.id)!;
    await prisma.productVariant.update({
      where: { id: variantId },
      data: {
        isEnabled: variantsWithRecipes.has(variantId),
      },
    });
  }

  const fallbackUser = await prisma.user.findFirstOrThrow({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const staffUser = await prisma.user.findUnique({
    where: { email: 'staff@stockscout.com' },
    select: { id: true },
  });

  for (const stockRunRow of stockRunRows) {
    const existing = await prisma.stockRun.findFirst({
      where: {
        name: stockRunRow.name,
        createdAt: parseDateTime(stockRunRow.created_at) ?? undefined,
      },
      select: { id: true },
    });

    const stockRun = existing
      ? await prisma.stockRun.update({
          where: { id: existing.id },
          data: {
            status: StockRunStatus.POSTED,
            totalCost: parseDecimal(stockRunRow.total_cost),
            notes: stockRunRow.notes || null,
            postedAt: parseDateTime(stockRunRow.created_at),
          },
        })
      : await prisma.stockRun.create({
          data: {
            name: stockRunRow.name,
            status: StockRunStatus.POSTED,
            createdByUserId: staffUser?.id ?? fallbackUser.id,
            totalCost: parseDecimal(stockRunRow.total_cost),
            notes: stockRunRow.notes || null,
            postedAt: parseDateTime(stockRunRow.created_at),
            createdAt: parseDateTime(stockRunRow.created_at) ?? new Date(),
            updatedAt: parseDateTime(stockRunRow.created_at) ?? new Date(),
          },
        });

    stockRunIdMap.set(stockRunRow.id, stockRun.id);
  }

  for (const stockRunItemRow of stockRunItemRows) {
    const stockRunId = stockRunIdMap.get(stockRunItemRow.stock_run_id);
    const rawMaterialId = rawMaterialIdMap.get(stockRunItemRow.raw_material_id);
    if (!stockRunId || !rawMaterialId) {
      throw new Error(
        `Invalid stock run item ${JSON.stringify(stockRunItemRow)}`,
      );
    }

    const existing = await prisma.stockRunItem.findFirst({
      where: {
        stockRunId,
        rawMaterialId,
        quantity: parseDecimal(stockRunItemRow.quantity),
        costPerUnit: parseDecimal(stockRunItemRow.cost_per_unit),
        expirationDate: parseDateOnly(stockRunItemRow.expiration_date),
      },
      select: { id: true },
    });

    const item = existing
      ? await prisma.stockRunItem.update({
          where: { id: existing.id },
          data: {
            quantity: parseDecimal(stockRunItemRow.quantity),
            costPerUnit: parseDecimal(stockRunItemRow.cost_per_unit),
            expirationDate: parseDateOnly(stockRunItemRow.expiration_date),
          },
        })
      : await prisma.stockRunItem.create({
          data: {
            stockRunId,
            rawMaterialId,
            quantity: parseDecimal(stockRunItemRow.quantity),
            costPerUnit: parseDecimal(stockRunItemRow.cost_per_unit),
            expirationDate: parseDateOnly(stockRunItemRow.expiration_date),
          },
        });

    stockRunItemIdMap.set(
      `${stockRunItemRow.stock_run_id}:${stockRunItemRow.raw_material_id}:${stockRunItemRow.quantity}`,
      item.id,
    );
  }

  for (const stockBatchRow of stockBatchRows) {
    const rawMaterialId = rawMaterialIdMap.get(stockBatchRow.raw_material_id);
    const supplierId = stockBatchRow.supplier_id
      ? (supplierIdMap.get(stockBatchRow.supplier_id) ?? null)
      : null;

    if (!rawMaterialId) {
      throw new Error(
        `Stock batch references missing raw material ${stockBatchRow.raw_material_id}`,
      );
    }

    const initialQuantity = parseDecimal(stockBatchRow.quantity);
    const remainingQuantity = parseDecimal(stockBatchRow.remaining_quantity);
    if (
      initialQuantity.lessThan(0) ||
      remainingQuantity.lessThan(0) ||
      remainingQuantity.greaterThan(initialQuantity)
    ) {
      throw new Error(
        `Invalid stock batch quantities for batch ${stockBatchRow.id}`,
      );
    }

    const existing = await prisma.stockBatch.findFirst({
      where: {
        rawMaterialId,
        initialQuantity,
        remainingQuantity,
        costPerUnit: parseDecimal(stockBatchRow.cost_per_unit),
        expirationDate: parseDateOnly(stockBatchRow.expiration_date),
        receivedAt: parseDateTime(stockBatchRow.received_at) ?? undefined,
      },
      select: { id: true },
    });

    const batch = existing
      ? await prisma.stockBatch.update({
          where: { id: existing.id },
          data: {
            supplierId,
          },
        })
      : await prisma.stockBatch.create({
          data: {
            rawMaterialId,
            supplierId,
            initialQuantity,
            remainingQuantity,
            costPerUnit: parseDecimal(stockBatchRow.cost_per_unit),
            expirationDate: parseDateOnly(stockBatchRow.expiration_date),
            receivedAt: parseDateTime(stockBatchRow.received_at) ?? new Date(),
            createdAt: parseDateTime(stockBatchRow.created_at) ?? new Date(),
            updatedAt: parseDateTime(stockBatchRow.updated_at) ?? new Date(),
          },
        });

    stockBatchIdMap.set(stockBatchRow.id, batch.id);
  }

  await prisma.rawMaterialInventorySummary.deleteMany();
  const rawMaterials = await prisma.rawMaterial.findMany({
    select: { id: true },
  });
  const businessDate = new Date();
  businessDate.setHours(0, 0, 0, 0);

  for (const rawMaterial of rawMaterials) {
    const batches = await prisma.stockBatch.findMany({
      where: { rawMaterialId: rawMaterial.id },
      select: {
        remainingQuantity: true,
        expirationDate: true,
      },
    });

    const onHandQuantity = batches.reduce(
      (total, batch) => total.plus(batch.remainingQuantity),
      new Prisma.Decimal(0),
    );
    const usableQuantity = batches.reduce((total, batch) => {
      if (batch.expirationDate && batch.expirationDate < businessDate) {
        return total;
      }
      return total.plus(batch.remainingQuantity);
    }, new Prisma.Decimal(0));
    const nearestExpiryDate =
      batches
        .filter(
          (batch) =>
            batch.remainingQuantity.greaterThan(0) &&
            batch.expirationDate &&
            batch.expirationDate >= businessDate,
        )
        .sort(
          (left, right) =>
            left.expirationDate!.getTime() - right.expirationDate!.getTime(),
        )[0]?.expirationDate ?? null;

    await prisma.rawMaterialInventorySummary.create({
      data: {
        rawMaterialId: rawMaterial.id,
        onHandQuantity,
        usableQuantity,
        nearestExpiryDate,
        activeBatchCount: batches.filter((batch) =>
          batch.remainingQuantity.greaterThan(0),
        ).length,
      },
    });
  }

  await prisma.variantAvailabilitySummary.deleteMany();
  const materialSummaryMap = new Map(
    (
      await prisma.rawMaterialInventorySummary.findMany({
        select: {
          rawMaterialId: true,
          usableQuantity: true,
        },
      })
    ).map((summary) => [summary.rawMaterialId, summary.usableQuantity]),
  );
  const requiredModifierConfigByProductId = new Map<string, boolean>();
  const requiredModifierGroups = await prisma.productModifierGroup.findMany({
    where: {
      isRequired: true,
    },
    select: {
      productId: true,
      modifierGroup: {
        select: {
          modifiers: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      },
    },
  });
  for (const group of requiredModifierGroups) {
    requiredModifierConfigByProductId.set(
      group.productId,
      group.modifierGroup.modifiers.length > 0,
    );
  }

  const variants = await prisma.productVariant.findMany({
    include: {
      product: true,
      recipeItems: true,
    },
  });

  for (const variant of variants) {
    const hasRecipe = variant.recipeItems.length > 0;
    const availableBaseQty = hasRecipe
      ? variant.recipeItems.reduce<number>((lowest, item) => {
          const usable =
            materialSummaryMap.get(item.rawMaterialId) ?? new Prisma.Decimal(0);
          return Math.min(
            lowest,
            Math.floor(usable.dividedBy(item.quantity).toNumber()),
          );
        }, Number.MAX_SAFE_INTEGER)
      : 0;
    const isInStock = hasRecipe && availableBaseQty >= 1;

    let blockingReason: AvailabilityBlockingReason =
      AvailabilityBlockingReason.NONE;
    if (!hasRecipe) {
      blockingReason = AvailabilityBlockingReason.NO_RECIPE;
    } else if (!variant.product.isEnabled) {
      blockingReason = AvailabilityBlockingReason.DISABLED_PRODUCT;
    } else if (!variant.isEnabled) {
      blockingReason = AvailabilityBlockingReason.DISABLED_VARIANT;
    } else if (!isInStock) {
      blockingReason = AvailabilityBlockingReason.INSUFFICIENT_STOCK;
    } else if (
      requiredModifierConfigByProductId.get(variant.productId) === false
    ) {
      blockingReason = AvailabilityBlockingReason.NO_VALID_REQUIRED_MODIFIER;
    }

    await prisma.variantAvailabilitySummary.create({
      data: {
        productVariantId: variant.id,
        isInStock,
        isSellable: blockingReason === AvailabilityBlockingReason.NONE,
        availableBaseQty,
        blockingReason,
      },
    });
  }

  for (const orderRow of orderRows) {
    const order = await prisma.order.upsert({
      where: { idempotencyKey: `seed-order-${orderRow.id}` },
      update: {
        status: OrderStatus.COMPLETED,
        subtotalAmount: parseDecimal(orderRow.total_amount),
        totalAmount: parseDecimal(orderRow.total_amount),
        taxAmount: new Prisma.Decimal(0),
        totalCogsAmount: new Prisma.Decimal(0),
        completedAt: parseDateTime(orderRow.created_at) ?? new Date(),
      },
      create: {
        status: OrderStatus.COMPLETED,
        createdByUserId: staffUser?.id ?? fallbackUser.id,
        idempotencyKey: `seed-order-${orderRow.id}`,
        subtotalAmount: parseDecimal(orderRow.total_amount),
        discountAmount: new Prisma.Decimal(0),
        discountRate: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
        totalAmount: parseDecimal(orderRow.total_amount),
        totalCogsAmount: new Prisma.Decimal(0),
        completedAt: parseDateTime(orderRow.created_at) ?? new Date(),
        createdAt: parseDateTime(orderRow.created_at) ?? new Date(),
        updatedAt: parseDateTime(orderRow.created_at) ?? new Date(),
      },
    });

    orderIdMap.set(orderRow.id, order.id);

    const paymentMethod = Object.values(PaymentMethod).includes(
      orderRow.payment_type as PaymentMethod,
    )
      ? (orderRow.payment_type as PaymentMethod)
      : PaymentMethod.OTHER;

    const existingPayment = await prisma.orderPayment.findFirst({
      where: {
        orderId: order.id,
        method: paymentMethod,
      },
      select: { id: true },
    });

    if (existingPayment) {
      await prisma.orderPayment.update({
        where: { id: existingPayment.id },
        data: {
          amount: parseDecimal(orderRow.total_amount),
          receivedAt: parseDateTime(orderRow.created_at) ?? new Date(),
        },
      });
    } else {
      await prisma.orderPayment.create({
        data: {
          orderId: order.id,
          method: paymentMethod,
          amount: parseDecimal(orderRow.total_amount),
          receivedAt: parseDateTime(orderRow.created_at) ?? new Date(),
          createdAt: parseDateTime(orderRow.created_at) ?? new Date(),
          updatedAt: parseDateTime(orderRow.created_at) ?? new Date(),
        },
      });
    }
  }

  for (const orderItemRow of orderItemRows) {
    const orderId = orderIdMap.get(orderItemRow.order_id);
    const productVariantId = productVariantIdMap.get(
      orderItemRow.product_variant_id,
    );
    if (!orderId || !productVariantId) {
      throw new Error(`Invalid order item ${JSON.stringify(orderItemRow)}`);
    }

    const variant = await prisma.productVariant.findUniqueOrThrow({
      where: { id: productVariantId },
      include: { product: true },
    });

    const existing = await prisma.orderItem.findFirst({
      where: {
        orderId,
        productVariantId,
        createdAt: parseDateTime(orderItemRow.created_at) ?? undefined,
      },
      select: { id: true },
    });

    const orderItem = existing
      ? await prisma.orderItem.update({
          where: { id: existing.id },
          data: {
            quantity: Number(orderItemRow.quantity),
            unitBasePrice: parseDecimal(orderItemRow.price),
            unitFinalPrice: parseDecimal(orderItemRow.price),
            lineSubtotal: parseDecimal(orderItemRow.price).mul(
              Number(orderItemRow.quantity),
            ),
            note: orderItemRow.notes || null,
          },
        })
      : await prisma.orderItem.create({
          data: {
            orderId,
            productVariantId,
            quantity: Number(orderItemRow.quantity),
            unitBasePrice: parseDecimal(orderItemRow.price),
            unitModifierAmount: new Prisma.Decimal(0),
            unitFinalPrice: parseDecimal(orderItemRow.price),
            lineSubtotal: parseDecimal(orderItemRow.price).mul(
              Number(orderItemRow.quantity),
            ),
            unitCogsAmount: new Prisma.Decimal(0),
            lineCogsAmount: new Prisma.Decimal(0),
            note: orderItemRow.notes || null,
            productNameSnapshot: variant.product.name,
            variantNameSnapshot: variant.name,
            skuSnapshot: variant.sku,
            createdAt: parseDateTime(orderItemRow.created_at) ?? new Date(),
            updatedAt: parseDateTime(orderItemRow.created_at) ?? new Date(),
          },
        });

    orderItemIdMap.set(orderItemRow.id, orderItem.id);
  }

  for (const orderItemModifierRow of orderItemModifierRows) {
    const orderItemId = orderItemIdMap.get(orderItemModifierRow.order_item_id);
    const modifierId = modifierIdMap.get(orderItemModifierRow.modifier_id);
    if (!orderItemId || !modifierId) {
      throw new Error(
        `Invalid order item modifier ${JSON.stringify(orderItemModifierRow)}`,
      );
    }

    const modifier = await prisma.modifier.findUniqueOrThrow({
      where: { id: modifierId },
    });
    const existing = await prisma.orderItemModifier.findFirst({
      where: { orderItemId, modifierId },
      select: { id: true },
    });

    if (existing) {
      await prisma.orderItemModifier.update({
        where: { id: existing.id },
        data: {
          unitPriceAdjustment: parseDecimal(orderItemModifierRow.price),
          lineTotal: parseDecimal(orderItemModifierRow.price),
        },
      });
    } else {
      await prisma.orderItemModifier.create({
        data: {
          orderItemId,
          modifierId,
          modifierNameSnapshot: modifier.name,
          unitPriceAdjustment: parseDecimal(orderItemModifierRow.price),
          quantity: 1,
          lineTotal: parseDecimal(orderItemModifierRow.price),
        },
      });
    }
  }

  const flatSkuSet = new Set(flatRows.map((row) => row.sku));
  for (const variantRow of productVariantRows) {
    if (!flatSkuSet.has(variantRow.sku)) {
      throw new Error(
        `Variant ${variantRow.sku} is missing from the flat validation CSV`,
      );
    }
  }

  const incompleteStockMovements = stockMovementRows.filter(
    (row) => row.reason === 'SALE' && !row.batch_id,
  );
  if (incompleteStockMovements.length > 0) {
    console.warn(
      `Skipped ${incompleteStockMovements.length} stock movement row(s) without batch allocation; stock movements are reference-only input.`,
    );
  }

  console.log('Café Phase 1 seed import completed successfully.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
