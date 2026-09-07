const assert = require('node:assert/strict');
const { PrismaClient, Prisma, InventoryTransactionType, InventorySourceType } = require('@prisma/client');
const { loadEnvFile } = require('node:process');

loadEnvFile();

const prisma = new PrismaClient();
const ZERO = new Prisma.Decimal(0);
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';
const PRODUCT_ID = '2f6076bb-4783-4c46-9721-95631dff2c1e';
const RECIPE_VARIANT_ID = '8f82f2e3-3de0-4539-80a0-1f635bb48474';
const ORDER_ID = '0bbcc45b-8ea1-4941-a1f7-dc723e48a30a';
const ONE_DAY_DATE = '2026-04-04';
const RANGE_END_DATE = '2026-04-04';

function formatDate(date) {
  return date ? new Date(date).toISOString() : null;
}

function sanitizeMessage(message) {
  if (Array.isArray(message)) {
    return message.join('; ');
  }
  return message ?? null;
}

async function latest(table, expr) {
  return (
    await prisma.$queryRawUnsafe(
      `select count(*)::int as count, ${expr} as latest from public.${table}`,
    )
  )[0];
}

async function getFingerprint() {
  const tableStates = {
    users: await latest('users', "max(greatest(created_at, updated_at, coalesce(last_login_at, created_at), password_changed_at, coalesce(locked_until, created_at)))::text"),
    auth_sessions: await latest('auth_sessions', "max(greatest(created_at, last_seen_at, idle_expires_at, expires_at, coalesce(revoked_at, created_at)))::text"),
    products: await latest('products', "max(greatest(created_at, updated_at, coalesce(archived_at, created_at)))::text"),
    product_variants: await latest('product_variants', "max(greatest(created_at, updated_at))::text"),
    variant_recipe_items: await latest('variant_recipe_items', "max(greatest(created_at, updated_at))::text"),
    raw_materials: await latest('raw_materials', "max(greatest(created_at, updated_at))::text"),
    raw_material_inventory_summaries: await latest('raw_material_inventory_summaries', "max(greatest(updated_at, coalesce(nearest_expiry_date::timestamp, '-infinity'::timestamp)))::text"),
    variant_availability_summaries: await latest('variant_availability_summaries', "max(updated_at)::text"),
    variant_availability_events: await latest('variant_availability_events', "max(greatest(created_at, occurred_at))::text"),
    stockout_events: await latest('stockout_events', "max(greatest(created_at, updated_at, started_at, coalesce(ended_at, started_at)))::text"),
    orders: await latest('orders', "max(greatest(created_at, updated_at, completed_at))::text"),
    order_items: await latest('order_items', "max(greatest(created_at, updated_at))::text"),
    order_payments: await latest('order_payments', "max(greatest(created_at, updated_at, received_at))::text"),
    order_reversals: await latest('order_reversals', "max(greatest(created_at, updated_at, occurred_at))::text"),
    inventory_transactions: await latest('inventory_transactions', "max(greatest(created_at, updated_at, occurred_at))::text"),
    inventory_transaction_lines: await latest('inventory_transaction_lines', "max(created_at)::text"),
    alerts: await latest('alerts', "max(greatest(created_at, updated_at, first_triggered_at, last_triggered_at, coalesce(acknowledged_at, created_at), coalesce(dismissed_at, created_at), coalesce(resolved_at, created_at)))::text"),
    outbox_events: await latest('outbox_events', "max(greatest(created_at, updated_at, available_at, coalesce(processed_at, created_at)))::text"),
    inventory_daily_snapshots: await latest('inventory_daily_snapshots', "max(greatest(created_at, snapshot_date::timestamp))::text"),
    stock_batches: await latest('stock_batches', "max(greatest(created_at, updated_at))::text"),
  };

  const [productCounts, variantCounts, recipeRowCount, ledgerBackedCompletedOrderCount] =
    await Promise.all([
      prisma.$queryRawUnsafe(`
        select
          count(*) filter (where is_enabled = true)::int as enabled_count,
          count(*) filter (where is_enabled = false)::int as disabled_count,
          count(*) filter (where archived_at is not null)::int as archived_count
        from products
      `),
      prisma.$queryRawUnsafe(`
        select
          count(*) filter (where is_enabled = true)::int as enabled_count,
          count(*) filter (where is_enabled = false)::int as disabled_count
        from product_variants
      `),
      prisma.variantRecipeItem.count(),
      prisma.order.count({
        where: {
          status: 'COMPLETED',
          items: {
            some: {
              inventoryLines: {
                some: {
                  inventoryTransaction: {
                    type: InventoryTransactionType.CHECKOUT,
                    sourceType: InventorySourceType.ORDER,
                  },
                },
              },
            },
          },
        },
      }),
    ]);

  return {
    tableStates,
    aggregates: {
      enabledProductCount: productCounts[0].enabled_count,
      disabledProductCount: productCounts[0].disabled_count,
      archivedProductCount: productCounts[0].archived_count,
      enabledVariantCount: variantCounts[0].enabled_count,
      disabledVariantCount: variantCounts[0].disabled_count,
      recipeRowCount,
      ledgerBackedCompletedOrderCount,
      existingSessionCount: tableStates.auth_sessions.count,
    },
  };
}

function normalizeNonSessionFingerprint(fingerprint) {
  const clone = JSON.parse(JSON.stringify(fingerprint));
  delete clone.tableStates.auth_sessions;
  delete clone.tableStates.users;
  delete clone.aggregates.existingSessionCount;
  return clone;
}

async function getUsersState(userIds) {
  const rows = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      role: true,
      isActive: true,
      email: true,
      lastLoginAt: true,
      failedLoginAttempts: true,
      lockedUntil: true,
      passwordChangedAt: true,
      updatedAt: true,
    },
    orderBy: { id: 'asc' },
  });
  return rows.map((row) => ({
    ...row,
    lastLoginAt: formatDate(row.lastLoginAt),
    lockedUntil: formatDate(row.lockedUntil),
    passwordChangedAt: formatDate(row.passwordChangedAt),
    updatedAt: formatDate(row.updatedAt),
  }));
}

async function getUserSessions(userId) {
  const rows = await prisma.authSession.findMany({
    where: { userId },
    select: {
      id: true,
      createdAt: true,
      lastSeenAt: true,
      idleExpiresAt: true,
      revokedAt: true,
      revokeReason: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  return rows.map((row) => ({
    ...row,
    createdAt: formatDate(row.createdAt),
    lastSeenAt: formatDate(row.lastSeenAt),
    idleExpiresAt: formatDate(row.idleExpiresAt),
    revokedAt: formatDate(row.revokedAt),
    expiresAt: formatDate(row.expiresAt),
  }));
}

function getManilaBusinessDateRange(value) {
  return {
    from: new Date(`${value}T00:00:00.000+08:00`),
    to: new Date(`${value}T23:59:59.999+08:00`),
  };
}

function shiftManilaBusinessDateInput(value, offsetDays) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function resolveUsageRange(scope, businessDate, endDate) {
  if (scope === 'ONE_DAY') {
    const oneDay = getManilaBusinessDateRange(businessDate);
    return {
      startAt: oneDay.from,
      endAt: getManilaBusinessDateRange(
        shiftManilaBusinessDateInput(businessDate, 1),
      ).from,
      coveredDates: [businessDate],
    };
  }

  const days = scope === 'LAST_7_DAYS' ? 7 : 30;
  const startDateInput = shiftManilaBusinessDateInput(endDate, -(days - 1));
  const startAt = getManilaBusinessDateRange(startDateInput).from;
  const endAt = getManilaBusinessDateRange(
    shiftManilaBusinessDateInput(endDate, 1),
  ).from;
  const coveredDates = [];
  for (let index = 0; index < days; index += 1) {
    coveredDates.push(shiftManilaBusinessDateInput(startDateInput, index));
  }
  return { startAt, endAt, coveredDates };
}

function aggregateIngredientUsage(lines) {
  const materialMap = new Map();
  for (const line of lines) {
    const key = line.rawMaterialId;
    const current =
      materialMap.get(key) ?? {
        rawMaterialId: key,
        rawMaterialName: line.rawMaterial.name,
        unit: line.rawMaterial.unit,
        grossQuantity: ZERO,
        reversedQuantity: ZERO,
        netQuantity: ZERO,
        grossCost: ZERO,
        reversedCost: ZERO,
        netCost: ZERO,
      };
    if (line.inventoryTransaction.type === InventoryTransactionType.CHECKOUT) {
      current.grossQuantity = current.grossQuantity.plus(
        line.quantityDelta.abs(),
      );
      current.grossCost = current.grossCost.plus(line.totalCostDelta.abs());
    } else {
      current.reversedQuantity = current.reversedQuantity.plus(
        line.quantityDelta.abs(),
      );
      current.reversedCost = current.reversedCost.plus(
        line.totalCostDelta.abs(),
      );
    }
    current.netQuantity = current.grossQuantity.minus(current.reversedQuantity);
    current.netCost = current.grossCost.minus(current.reversedCost);
    materialMap.set(key, current);
  }

  return [...materialMap.values()]
    .sort((left, right) => left.rawMaterialName.localeCompare(right.rawMaterialName))
    .map((item) => ({
      ...item,
      grossQuantity: item.grossQuantity.toString(),
      reversedQuantity: item.reversedQuantity.toString(),
      netQuantity: item.netQuantity.toString(),
      grossCost: item.grossCost.toString(),
      reversedCost: item.reversedCost.toString(),
      netCost: item.netCost.toString(),
    }));
}

function buildVariantBreakdown(lines, matchingOrderItems) {
  const orderUnitsByVariantId = new Map();
  for (const item of matchingOrderItems) {
    orderUnitsByVariantId.set(
      item.productVariantId,
      (orderUnitsByVariantId.get(item.productVariantId) ?? 0) + item.quantity,
    );
  }

  const variantMap = new Map();
  for (const line of lines) {
    if (!line.productVariant) continue;
    const key = line.productVariant.id;
    const current =
      variantMap.get(key) ?? {
        productVariantId: key,
        variantName: line.productVariant.name,
        sku: line.productVariant.sku,
        productUnitsSold: orderUnitsByVariantId.get(key) ?? 0,
        grossIngredientCost: ZERO,
        reversedIngredientCost: ZERO,
        netIngredientCost: ZERO,
      };
    if (line.inventoryTransaction.type === InventoryTransactionType.CHECKOUT) {
      current.grossIngredientCost = current.grossIngredientCost.plus(
        line.totalCostDelta.abs(),
      );
    } else {
      current.reversedIngredientCost = current.reversedIngredientCost.plus(
        line.totalCostDelta.abs(),
      );
    }
    current.netIngredientCost = current.grossIngredientCost.minus(
      current.reversedIngredientCost,
    );
    variantMap.set(key, current);
  }

  return [...variantMap.values()]
    .sort((left, right) => left.variantName.localeCompare(right.variantName))
    .map((item) => ({
      ...item,
      grossIngredientCost: item.grossIngredientCost.toString(),
      reversedIngredientCost: item.reversedIngredientCost.toString(),
      netIngredientCost: item.netIngredientCost.toString(),
    }));
}

async function getExpectedProductUsage(productId, scope, businessDate, endDate) {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { id: true, name: true, variants: { select: { id: true } } },
  });
  const variantIds = product.variants.map((variant) => variant.id);
  const range = resolveUsageRange(scope, businessDate, endDate);
  const [lines, matchingOrderItems] = await Promise.all([
    prisma.inventoryTransactionLine.findMany({
      where: {
        productVariantId: { in: variantIds },
        inventoryTransaction: {
          occurredAt: { gte: range.startAt, lt: range.endAt },
          type: {
            in: [
              InventoryTransactionType.CHECKOUT,
              InventoryTransactionType.VOID,
              InventoryTransactionType.REFUND,
            ],
          },
        },
      },
      include: {
        rawMaterial: { include: { unit: true } },
        productVariant: { select: { id: true, name: true, sku: true } },
        inventoryTransaction: {
          select: { id: true, type: true, occurredAt: true, sourceId: true },
        },
      },
    }),
    prisma.orderItem.findMany({
      where: {
        productVariantId: { in: variantIds },
        order: {
          completedAt: { gte: range.startAt, lt: range.endAt },
        },
      },
      select: {
        id: true,
        quantity: true,
        orderId: true,
        productVariantId: true,
      },
    }),
  ]);

  return {
    productId: product.id,
    productName: product.name,
    scope,
    startAt: formatDate(range.startAt),
    endAt: formatDate(range.endAt),
    coveredDates: range.coveredDates,
    distinctOrderCount: new Set(matchingOrderItems.map((item) => item.orderId)).size,
    productUnitsSold: matchingOrderItems.reduce((sum, item) => sum + item.quantity, 0),
    ingredientRowCount: aggregateIngredientUsage(lines).length,
    ingredients: aggregateIngredientUsage(lines),
    variantBreakdown: buildVariantBreakdown(lines, matchingOrderItems),
    transactionCount: new Set(lines.map((line) => line.inventoryTransaction.id)).size,
  };
}

async function getExpectedOrderUsage(productId, orderId) {
  const product = await prisma.product.findUniqueOrThrow({
    where: { id: productId },
    select: { id: true, name: true, variants: { select: { id: true } } },
  });
  const variantIds = product.variants.map((variant) => variant.id);
  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: {
        where: { productVariantId: { in: variantIds } },
        select: {
          id: true,
          quantity: true,
          productVariantId: true,
          productNameSnapshot: true,
          variantNameSnapshot: true,
          skuSnapshot: true,
        },
      },
      payments: { select: { id: true } },
    },
  });
  const targetOrderItemIds = order.items.map((item) => item.id);
  const lines = await prisma.inventoryTransactionLine.findMany({
    where: {
      OR: [
        {
          inventoryTransaction: {
            type: InventoryTransactionType.CHECKOUT,
            sourceType: InventorySourceType.ORDER,
            sourceId: orderId,
          },
          productVariantId: { in: variantIds },
        },
        {
          inventoryTransaction: {
            type: {
              in: [InventoryTransactionType.VOID, InventoryTransactionType.REFUND],
            },
          },
          orderItemId: { in: targetOrderItemIds },
        },
      ],
    },
    include: {
      rawMaterial: { include: { unit: true } },
      productVariant: { select: { id: true, name: true, sku: true } },
      inventoryTransaction: {
        select: { id: true, type: true, occurredAt: true, sourceId: true },
      },
    },
  });

  return {
    orderId: order.id,
    orderStatus: order.status,
    completedAt: formatDate(order.completedAt),
    productId: product.id,
    productName: product.name,
    productUnitsSold: order.items.reduce((sum, item) => sum + item.quantity, 0),
    paymentsCount: order.payments.length,
    variants: order.items.map((item) => ({
      orderItemId: item.id,
      productVariantId: item.productVariantId,
      productNameSnapshot: item.productNameSnapshot,
      variantNameSnapshot: item.variantNameSnapshot,
      skuSnapshot: item.skuSnapshot,
      quantity: item.quantity,
    })),
    ingredients: aggregateIngredientUsage(lines),
    transactionCount: new Set(lines.map((line) => line.inventoryTransaction.id)).size,
  };
}

async function verifyFixtures() {
  const product = await prisma.product.findUnique({
    where: { id: PRODUCT_ID },
    include: {
      category: true,
      variants: {
        include: {
          availabilitySummary: true,
          recipeItems: true,
        },
      },
    },
  });
  const recipeVariant = await prisma.productVariant.findUnique({
    where: { id: RECIPE_VARIANT_ID },
    include: {
      recipeItems: { include: { rawMaterial: { include: { unit: true } } } },
      availabilitySummary: true,
      product: true,
    },
  });
  const noRecipeVariant = await prisma.productVariant.findFirst({
    where: {
      product: { name: { not: { startsWith: 'inventory_reports_phase' } } },
      recipeItems: { none: {} },
    },
    include: {
      product: true,
      availabilitySummary: true,
      recipeItems: true,
    },
    orderBy: { name: 'asc' },
  });
  const order = await prisma.order.findUnique({
    where: { id: ORDER_ID },
    include: {
      payments: true,
      items: {
        include: {
          inventoryLines: {
            include: {
              inventoryTransaction: true,
            },
          },
        },
      },
    },
  });
  const eligibleProduct = await prisma.product.findFirst({
    where: {
      archivedAt: null,
      name: { not: { startsWith: 'inventory_reports_phase' } },
      variants: {
        some: {},
        every: {
          orderItems: { none: {} },
          transactionLines: { none: {} },
          availabilityEvents: { none: {} },
          stockoutEvents: { none: {} },
        },
      },
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  return {
    product,
    recipeVariant,
    noRecipeVariant,
    order,
    eligibleProduct,
  };
}

function deepEqualJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertJsonEqual(actual, expected, message) {
  assert.equal(
    JSON.stringify(actual),
    JSON.stringify(expected),
    `${message}\nexpected=${JSON.stringify(expected)}\nactual=${JSON.stringify(actual)}`,
  );
}

function toOrderReference(orderId) {
  const [prefix] = orderId.split('-');
  return `ORD-${(prefix ?? orderId).toUpperCase()}`;
}

function normalizeExpectedProductUsage(expected) {
  return {
    productId: expected.productId,
    productName: expected.productName,
    scope: expected.scope,
    startAt: expected.startAt,
    endAt: expected.endAt,
    coveredDates: expected.coveredDates,
    distinctOrderCount: expected.distinctOrderCount,
    productUnitsSold: expected.productUnitsSold,
    ingredientRowCount: expected.ingredientRowCount,
    ingredients: expected.ingredients.map((item) => ({
      ...item,
      unit: {
        id: item.unit.id,
        code: item.unit.code,
        name: item.unit.name,
        dimension: item.unit.dimension,
      },
    })),
    variantBreakdown: expected.variantBreakdown,
  };
}

function normalizeExpectedOrderUsage(expected) {
  return {
    orderId: expected.orderId,
    orderReference: toOrderReference(expected.orderId),
    orderStatus: expected.orderStatus,
    completedAt: expected.completedAt,
    productId: expected.productId,
    productName: expected.productName,
    productUnitsSold: expected.productUnitsSold,
    variants: expected.variants,
    ingredients: expected.ingredients.map((item) => ({
      ...item,
      unit: {
        id: item.unit.id,
        code: item.unit.code,
        name: item.unit.name,
        dimension: item.unit.dimension,
      },
    })),
  };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

class SessionClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookieHeader = null;
  }

  async request(method, path, options = {}) {
    const started = Date.now();
    const headers = { ...(options.headers ?? {}) };
    if (this.cookieHeader) {
      headers.Cookie = this.cookieHeader;
    }
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: options.json !== undefined ? JSON.stringify(options.json) : options.body,
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      this.cookieHeader = setCookie.split(';')[0];
    }
    return {
      status: response.status,
      body: await safeJson(response),
      elapsedMs: Date.now() - started,
    };
  }
}

function assertNoSecretsInBody(body) {
  if (!body || typeof body !== 'object') return;
  assert.equal('sessionToken' in body, false, 'response must not expose sessionToken');
  assert.equal('token' in body, false, 'response must not expose token');
  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes('SELECT '), false, 'response leaked SQL text');
}

async function runHttpTests() {
  const baseUrl = process.env.PHASE1_BASE_URL ?? 'http://127.0.0.1:4100';
  const roleInputs = {
    staff: {
      email: process.env.PHASE1_STAFF_EMAIL,
      password: process.env.PHASE1_STAFF_PASSWORD,
      userId: '77b76a40-8344-4469-8000-a7aa7066da25',
    },
    admin: {
      email: process.env.PHASE1_ADMIN_EMAIL,
      password: process.env.PHASE1_ADMIN_PASSWORD,
      userId: '755481e6-a252-49cb-a73e-34657841edb3',
    },
    secondaryAdmin: {
      email: process.env.PHASE1_SECONDARY_ADMIN_EMAIL,
      password: process.env.PHASE1_SECONDARY_ADMIN_PASSWORD,
      userId: 'f8868ca6-644d-407c-917e-db160746a3da',
    },
  };

  for (const [label, input] of Object.entries(roleInputs)) {
    assert(input.email, `${label} email is required`);
    assert(input.password, `${label} password is required`);
  }

  const fixtures = await verifyFixtures();
  assert(fixtures.product && !fixtures.product.archivedAt, 'Cafe Americano fixture must be active');
  assert(fixtures.product.variants.length > 0, 'Cafe Americano must have variants');
  assert(fixtures.recipeVariant && fixtures.recipeVariant.recipeItems.length > 0, 'recipe-bearing variant must have recipe items');
  assert(fixtures.noRecipeVariant, 'a no-recipe variant must exist');
  assert(fixtures.order && fixtures.order.status === 'COMPLETED', 'order fixture must be completed');
  assert(fixtures.order.payments.length > 0, 'order fixture must have payment evidence');
  assert(fixtures.eligibleProduct, 'a naturally eligible product must exist');

  const trackedUserIds = Object.values(roleInputs).map((input) => input.userId);
  const baselineNonSession = normalizeNonSessionFingerprint(await getFingerprint());
  const initialUsers = await getUsersState(trackedUserIds);

  const driftChecks = [];
  const roleMatrix = [];
  const httpReview = [];
  const sessionResults = [];
  const loginResults = {};

  async function assertNoNonSessionDrift(stage) {
    const current = normalizeNonSessionFingerprint(await getFingerprint());
    const match = deepEqualJson(current, baselineNonSession);
    driftChecks.push({ stage, match });
    assert(match, `non-session database drift detected at ${stage}`);
  }

  async function loginAs(roleLabel) {
    const input = roleInputs[roleLabel];
    const client = new SessionClient(baseUrl);
    const beforeSessions = await getUserSessions(input.userId);
    const beforeUser = (await getUsersState([input.userId]))[0];
    const result = await client.request('POST', '/auth/login', {
      json: { email: input.email, password: input.password },
    });
    assert.equal(result.status, 201, `${roleLabel} login must succeed`);
    assert(result.body && result.body.user, `${roleLabel} login must return user`);
    assertNoSecretsInBody(result.body);
    const afterSessions = await getUserSessions(input.userId);
    const afterUser = (await getUsersState([input.userId]))[0];
    const newSessions = afterSessions.filter(
      (session) => !beforeSessions.some((before) => before.id === session.id),
    );
    assert.equal(newSessions.length, 1, `${roleLabel} login must create exactly one session`);
    assert.equal(afterUser.role, beforeUser.role, `${roleLabel} role must not change`);
    assert.equal(afterUser.isActive, beforeUser.isActive, `${roleLabel} active state must not change`);
    await assertNoNonSessionDrift(`${roleLabel}-login`);
    loginResults[roleLabel] = {
      sessionId: newSessions[0].id,
      createdAt: newSessions[0].createdAt,
      lastSeenAt: newSessions[0].lastSeenAt,
      idleExpiresAt: newSessions[0].idleExpiresAt,
      revokedAt: newSessions[0].revokedAt,
      userLastLoginAtBefore: beforeUser.lastLoginAt,
      userLastLoginAtAfter: afterUser.lastLoginAt,
      userUpdatedAtAfter: afterUser.updatedAt,
    };
    return { client, sessionId: newSessions[0].id };
  }

  async function logoutRole(roleLabel, client, sessionId) {
    const result = await client.request('POST', '/auth/logout');
    assert.equal(result.status, 201, `${roleLabel} logout must succeed`);
    await assertNoNonSessionDrift(`${roleLabel}-logout`);
    const sessions = await getUserSessions(roleInputs[roleLabel].userId);
    const session = sessions.find((row) => row.id === sessionId);
    assert(session && session.revokedAt, `${roleLabel} session must be revoked after logout`);
    sessionResults.push({
      role: roleLabel,
      sessionId,
      revokeReason: session.revokeReason,
      revokedAt: session.revokedAt,
    });
  }

  const unauthenticatedClient = new SessionClient(baseUrl);
  const routeCases = [
    { key: 'list', path: '/admin/products' },
    { key: 'detail', path: `/admin/products/${PRODUCT_ID}` },
    { key: 'recipe', path: `/admin/variants/${RECIPE_VARIANT_ID}/recipe` },
    { key: 'deleteEligibility', path: `/admin/products/${PRODUCT_ID}/delete-eligibility` },
    { key: 'ingredientUsage', path: `/admin/products/${PRODUCT_ID}/ingredient-usage?scope=ONE_DAY&businessDate=${ONE_DAY_DATE}` },
    { key: 'orderUsage', path: `/admin/products/${PRODUCT_ID}/orders/${ORDER_ID}/ingredient-usage` },
  ];

  for (const route of routeCases) {
    const response = await unauthenticatedClient.request('GET', route.path);
    httpReview.push({ endpoint: route.path, role: 'unauthenticated', status: response.status, elapsedMs: response.elapsedMs });
    assert.equal(response.status, 401, `${route.key} unauthenticated must be rejected`);
    await assertNoNonSessionDrift(`unauth-${route.key}`);
  }

  const staff = await loginAs('staff');
  for (const route of routeCases) {
    const response = await staff.client.request('GET', route.path);
    httpReview.push({ endpoint: route.path, role: 'staff', status: response.status, elapsedMs: response.elapsedMs });
    assert.equal(response.status, 403, `${route.key} staff must be rejected`);
    await assertNoNonSessionDrift(`staff-${route.key}`);
    roleMatrix.push({ route: route.path, role: 'staff', status: response.status });
  }
  await logoutRole('staff', staff.client, staff.sessionId);

  const admin = await loginAs('admin');
  for (const route of routeCases) {
    const response = await admin.client.request('GET', route.path);
    httpReview.push({ endpoint: route.path, role: 'admin', status: response.status, elapsedMs: response.elapsedMs });
    assert.equal(response.status, 200, `${route.key} admin must be permitted`);
    await assertNoNonSessionDrift(`admin-${route.key}`);
    roleMatrix.push({ route: route.path, role: 'admin', status: response.status });
  }

  const secondaryAdmin = await loginAs('secondaryAdmin');
  for (const route of routeCases) {
    const response = await secondaryAdmin.client.request('GET', route.path);
    httpReview.push({ endpoint: route.path, role: 'secondary-admin', status: response.status, elapsedMs: response.elapsedMs });
    assert.equal(response.status, 200, `${route.key} secondary admin must be permitted`);
    await assertNoNonSessionDrift(`secondary-admin-${route.key}`);
    roleMatrix.push({ route: route.path, role: 'secondary-admin', status: response.status });
  }

  const listCases = [];
  const categoryId = fixtures.product.categoryId;
  async function runListCase(label, query, expectedStatus, verifier) {
    const path = `/admin/products${query ? `?${query}` : ''}`;
    const response = await admin.client.request('GET', path);
    httpReview.push({ endpoint: path, role: 'admin', status: response.status, elapsedMs: response.elapsedMs });
    assert.equal(response.status, expectedStatus, `${label} unexpected status`);
    await assertNoNonSessionDrift(`list-${label}`);
    const actual = verifier ? verifier(response.body) : {};
    listCases.push({ label, path, status: response.status, actual });
    return response.body;
  }

  const defaultList = await runListCase('default', '', 200, (body) => ({
    totalItems: body.pagination.totalItems,
    pageSize: body.pagination.pageSize,
    itemCount: body.items.length,
  }));
  await runListCase('search', 'search=Americano', 200, (body) => ({
    totalItems: body.pagination.totalItems,
    containsTarget: body.items.some((item) => item.id === PRODUCT_ID),
  }));
  await runListCase('category', `categoryId=${categoryId}`, 200, (body) => ({
    totalItems: body.pagination.totalItems,
    allCategoryMatch: body.items.every((item) => item.category.id === categoryId),
  }));
  await runListCase('manualAvailability', 'manualAvailability=ENABLED', 200, (body) => ({
    totalItems: body.pagination.totalItems,
    allEnabled: body.items.every((item) => item.manualAvailability === true),
  }));
  await runListCase('effectiveStatus', 'effectiveStatus=OUT_OF_STOCK', 200, (body) => ({
    totalItems: body.pagination.totalItems,
    containsTarget: body.items.some((item) => item.id === PRODUCT_ID),
  }));
  await runListCase('archiveActive', 'archiveState=ACTIVE', 200, (body) => ({
    totalItems: body.pagination.totalItems,
    allActive: body.items.every((item) => item.archivedAt === null),
  }));
  await runListCase('archiveArchived', 'archiveState=ARCHIVED', 200, (body) => ({
    totalItems: body.pagination.totalItems,
  }));
  await runListCase('sortNameAsc', 'sortBy=name&sortDirection=asc&pageSize=5', 200, (body) => ({
    firstFiveNames: body.items.map((item) => item.name),
  }));
  await runListCase('sortCategoryAsc', 'sortBy=category&sortDirection=asc&pageSize=5', 200, (body) => ({
    firstFiveCategories: body.items.map((item) => item.category.name),
  }));
  await runListCase('sortVariantCountDesc', 'sortBy=variantCount&sortDirection=desc&pageSize=5', 200, (body) => ({
    counts: body.items.map((item) => item.variantCount),
  }));
  await runListCase('sortIngredientCountDesc', 'sortBy=ingredientCount&sortDirection=desc&pageSize=5', 200, (body) => ({
    counts: body.items.map((item) => item.ingredientCount),
  }));
  await runListCase('sortUpdatedAtDesc', 'sortBy=updatedAt&sortDirection=desc&pageSize=5', 200, (body) => ({
    firstIds: body.items.map((item) => item.id),
  }));
  await runListCase('pageSizeMin', 'pageSize=1&page=1', 200, (body) => ({
    pageSize: body.pagination.pageSize,
    itemCount: body.items.length,
  }));
  await runListCase('pageSizeMax', 'pageSize=100&page=1', 200, (body) => ({
    pageSize: body.pagination.pageSize,
    itemCount: body.items.length,
  }));
  await runListCase('unknownCategory', `categoryId=${UNKNOWN_ID}`, 200, (body) => ({
    totalItems: body.pagination.totalItems,
  }));
  await runListCase('invalidPage', 'page=0', 400, (body) => ({ message: sanitizeMessage(body.message) }));
  await runListCase('invalidPageSize', 'pageSize=101', 400, (body) => ({ message: sanitizeMessage(body.message) }));

  const detailResponse = await admin.client.request('GET', `/admin/products/${PRODUCT_ID}`);
  assert.equal(detailResponse.status, 200, 'product detail must succeed');
  assertNoSecretsInBody(detailResponse.body);
  await assertNoNonSessionDrift('detail-valid');
  const unknownDetailResponse = await admin.client.request('GET', `/admin/products/${UNKNOWN_ID}`);
  assert.equal(unknownDetailResponse.status, 404, 'unknown product detail must 404');
  await assertNoNonSessionDrift('detail-unknown');

  const recipeValidResponse = await admin.client.request('GET', `/admin/variants/${RECIPE_VARIANT_ID}/recipe`);
  assert.equal(recipeValidResponse.status, 200, 'recipe read must succeed');
  await assertNoNonSessionDrift('recipe-valid');
  const recipeNoRecipeResponse = await admin.client.request('GET', `/admin/variants/${fixtures.noRecipeVariant.id}/recipe`);
  assert.equal(recipeNoRecipeResponse.status, 200, 'no-recipe variant read must still succeed');
  await assertNoNonSessionDrift('recipe-no-recipe');
  const recipeUnknownResponse = await admin.client.request('GET', `/admin/variants/${UNKNOWN_ID}/recipe`);
  assert.equal(recipeUnknownResponse.status, 404, 'unknown recipe read must 404');
  await assertNoNonSessionDrift('recipe-unknown');

  const deleteBlockedResponse = await admin.client.request('GET', `/admin/products/${PRODUCT_ID}/delete-eligibility`);
  assert.equal(deleteBlockedResponse.status, 200, 'blocked delete eligibility must succeed');
  await assertNoNonSessionDrift('delete-blocked');
  const deleteEligibleResponse = await admin.client.request('GET', `/admin/products/${fixtures.eligibleProduct.id}/delete-eligibility`);
  assert.equal(deleteEligibleResponse.status, 200, 'eligible delete eligibility must succeed');
  await assertNoNonSessionDrift('delete-eligible');
  const deleteUnknownResponse = await admin.client.request('GET', `/admin/products/${UNKNOWN_ID}/delete-eligibility`);
  assert.equal(deleteUnknownResponse.status, 404, 'unknown delete eligibility must 404');
  await assertNoNonSessionDrift('delete-unknown');

  const expectedOneDay = await getExpectedProductUsage(PRODUCT_ID, 'ONE_DAY', ONE_DAY_DATE, null);
  const expectedSevenDay = await getExpectedProductUsage(PRODUCT_ID, 'LAST_7_DAYS', null, RANGE_END_DATE);
  const expectedThirtyDay = await getExpectedProductUsage(PRODUCT_ID, 'LAST_30_DAYS', null, RANGE_END_DATE);
  const usageOneDayResponse = await admin.client.request('GET', `/admin/products/${PRODUCT_ID}/ingredient-usage?scope=ONE_DAY&businessDate=${ONE_DAY_DATE}`);
  const usageSevenDayResponse = await admin.client.request('GET', `/admin/products/${PRODUCT_ID}/ingredient-usage?scope=LAST_7_DAYS&endDate=${RANGE_END_DATE}`);
  const usageThirtyDayResponse = await admin.client.request('GET', `/admin/products/${PRODUCT_ID}/ingredient-usage?scope=LAST_30_DAYS&endDate=${RANGE_END_DATE}`);
  const usageInvalidResponse = await admin.client.request('GET', `/admin/products/${PRODUCT_ID}/ingredient-usage?scope=ONE_DAY`);
  assert.equal(usageOneDayResponse.status, 200);
  assert.equal(usageSevenDayResponse.status, 200);
  assert.equal(usageThirtyDayResponse.status, 200);
  assert.equal(usageInvalidResponse.status, 400);
  assertJsonEqual(
    usageOneDayResponse.body,
    normalizeExpectedProductUsage(expectedOneDay),
    'ONE_DAY product ingredient usage must match independently derived ledger expectation',
  );
  assertJsonEqual(
    usageSevenDayResponse.body,
    normalizeExpectedProductUsage(expectedSevenDay),
    'LAST_7_DAYS product ingredient usage must match independently derived ledger expectation',
  );
  assertJsonEqual(
    usageThirtyDayResponse.body,
    normalizeExpectedProductUsage(expectedThirtyDay),
    'LAST_30_DAYS product ingredient usage must match independently derived ledger expectation',
  );
  await assertNoNonSessionDrift('usage-scopes');
  const expectedOrderUsage = await getExpectedOrderUsage(PRODUCT_ID, ORDER_ID);
  const orderUsageResponse = await admin.client.request('GET', `/admin/products/${PRODUCT_ID}/orders/${ORDER_ID}/ingredient-usage`);
  const wrongProductOrderResponse = await admin.client.request('GET', `/admin/products/${fixtures.eligibleProduct.id}/orders/${ORDER_ID}/ingredient-usage`);
  const unknownProductOrderResponse = await admin.client.request('GET', `/admin/products/${UNKNOWN_ID}/orders/${ORDER_ID}/ingredient-usage`);
  const unknownOrderUsageResponse = await admin.client.request('GET', `/admin/products/${PRODUCT_ID}/orders/${UNKNOWN_ID}/ingredient-usage`);
  assert.equal(orderUsageResponse.status, 200);
  assert.equal(wrongProductOrderResponse.status, 400);
  assert.equal(unknownProductOrderResponse.status, 404);
  assert.equal(unknownOrderUsageResponse.status, 404);
  assertJsonEqual(
    orderUsageResponse.body,
    normalizeExpectedOrderUsage(expectedOrderUsage),
    'Per-order ingredient usage must match independently derived ledger expectation',
  );
  await assertNoNonSessionDrift('order-usage');

  await logoutRole('admin', admin.client, admin.sessionId);
  await logoutRole('secondaryAdmin', secondaryAdmin.client, secondaryAdmin.sessionId);

  const finalUsers = await getUsersState(trackedUserIds);
  const finalFingerprint = await getFingerprint();

  return {
    fixtures: {
      productId: fixtures.product.id,
      productName: fixtures.product.name,
      categoryId: fixtures.product.categoryId,
      noRecipeVariantId: fixtures.noRecipeVariant.id,
      noRecipeVariantName: fixtures.noRecipeVariant.name,
      eligibleProduct: fixtures.eligibleProduct,
      orderId: fixtures.order.id,
      orderPaymentsCount: fixtures.order.payments.length,
    },
    loginResults,
    driftChecks,
    roleMatrix,
    listCases,
    detail: {
      validStatus: detailResponse.status,
      unknownStatus: unknownDetailResponse.status,
      body: detailResponse.body,
    },
    recipe: {
      validStatus: recipeValidResponse.status,
      validBody: recipeValidResponse.body,
      noRecipeStatus: recipeNoRecipeResponse.status,
      noRecipeBody: recipeNoRecipeResponse.body,
      unknownStatus: recipeUnknownResponse.status,
    },
    deleteEligibility: {
      blocked: deleteBlockedResponse.body,
      eligible: deleteEligibleResponse.body,
      unknownStatus: deleteUnknownResponse.status,
    },
    usage: {
      oneDay: { expected: expectedOneDay, actual: usageOneDayResponse.body },
      last7: { expected: expectedSevenDay, actual: usageSevenDayResponse.body },
      last30: { expected: expectedThirtyDay, actual: usageThirtyDayResponse.body },
      invalidStatus: usageInvalidResponse.status,
      invalidMessage: sanitizeMessage(usageInvalidResponse.body?.message),
    },
    orderUsage: {
      expected: expectedOrderUsage,
      actual: orderUsageResponse.body,
      wrongProductStatus: wrongProductOrderResponse.status,
      wrongProductMessage: sanitizeMessage(wrongProductOrderResponse.body?.message),
      unknownProductStatus: unknownProductOrderResponse.status,
      unknownOrderStatus: unknownOrderUsageResponse.status,
    },
    httpReview,
    sessionResults,
    initialUsers,
    finalUsers,
    finalFingerprint,
  };
}

async function main() {
  const mode = process.argv[2];
  assert(mode, 'mode is required');
  let result;
  if (mode === 'fingerprint') {
    result = await getFingerprint();
  } else if (mode === 'fixtures') {
    result = await verifyFixtures();
  } else if (mode === 'run-http-tests') {
    result = await runHttpTests();
  } else {
    throw new Error(`Unsupported mode: ${mode}`);
  }
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
