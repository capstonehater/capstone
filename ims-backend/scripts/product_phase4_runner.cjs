const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadEnvFile } = require('node:process');
const { PrismaClient } = require('@prisma/client');

loadEnvFile();

const prisma = new PrismaClient();

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';
const HISTORICAL_PRODUCT_ID = '2f6076bb-4783-4c46-9721-95631dff2c1e';
const PRIMARY_PRODUCT_DELETE_ID = '14b6867c-87c1-4db1-8eaa-5b0fcbfc6e6a';
const PREFERRED_VARIANT_DELETE_PARENT_ID =
  '22cc760f-442e-4db5-a4d1-f0deec25990b';

function formatDate(value) {
  return value ? new Date(value).toISOString() : null;
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
    users: await latest(
      'users',
      "max(greatest(created_at, updated_at, coalesce(last_login_at, created_at), password_changed_at, coalesce(locked_until, created_at)))::text",
    ),
    auth_sessions: await latest(
      'auth_sessions',
      "max(greatest(created_at, last_seen_at, idle_expires_at, expires_at, coalesce(revoked_at, created_at)))::text",
    ),
    products: await latest(
      'products',
      "max(greatest(created_at, updated_at, coalesce(archived_at, created_at)))::text",
    ),
    product_variants: await latest(
      'product_variants',
      "max(greatest(created_at, updated_at))::text",
    ),
    variant_recipe_items: await latest(
      'variant_recipe_items',
      "max(greatest(created_at, updated_at))::text",
    ),
    raw_materials: await latest(
      'raw_materials',
      "max(greatest(created_at, updated_at))::text",
    ),
    raw_material_inventory_summaries: await latest(
      'raw_material_inventory_summaries',
      "max(greatest(updated_at, coalesce(nearest_expiry_date::timestamp, '-infinity'::timestamp)))::text",
    ),
    variant_availability_summaries: await latest(
      'variant_availability_summaries',
      'max(updated_at)::text',
    ),
    variant_availability_events: await latest(
      'variant_availability_events',
      "max(greatest(created_at, occurred_at))::text",
    ),
    stockout_events: await latest(
      'stockout_events',
      "max(greatest(created_at, updated_at, started_at, coalesce(ended_at, started_at)))::text",
    ),
    orders: await latest(
      'orders',
      "max(greatest(created_at, updated_at, completed_at))::text",
    ),
    order_items: await latest(
      'order_items',
      "max(greatest(created_at, updated_at))::text",
    ),
    order_payments: await latest(
      'order_payments',
      "max(greatest(created_at, updated_at, received_at))::text",
    ),
    order_reversals: await latest(
      'order_reversals',
      "max(greatest(created_at, updated_at, occurred_at))::text",
    ),
    inventory_transactions: await latest(
      'inventory_transactions',
      "max(greatest(created_at, updated_at, occurred_at))::text",
    ),
    inventory_transaction_lines: await latest(
      'inventory_transaction_lines',
      'max(created_at)::text',
    ),
    alerts: await latest(
      'alerts',
      "max(greatest(created_at, updated_at, first_triggered_at, last_triggered_at, coalesce(acknowledged_at, created_at), coalesce(dismissed_at, created_at), coalesce(resolved_at, created_at)))::text",
    ),
    outbox_events: await latest(
      'outbox_events',
      "max(greatest(created_at, updated_at, available_at, coalesce(processed_at, created_at)))::text",
    ),
    inventory_daily_snapshots: await latest(
      'inventory_daily_snapshots',
      "max(greatest(created_at, snapshot_date::timestamp))::text",
    ),
    stock_batches: await latest(
      'stock_batches',
      "max(greatest(created_at, updated_at))::text",
    ),
  };

  return { tableStates };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeNonSessionFingerprint(fingerprint) {
  const clone = cloneJson(fingerprint);
  delete clone.tableStates.users;
  delete clone.tableStates.auth_sessions;
  return clone;
}

function normalizeFingerprintExcludingAllowedVariantDeleteTables(fingerprint) {
  const clone = normalizeNonSessionFingerprint(fingerprint);
  delete clone.tableStates.product_variants;
  delete clone.tableStates.variant_recipe_items;
  delete clone.tableStates.variant_availability_summaries;
  delete clone.tableStates.variant_availability_events;
  return clone;
}

function normalizeFingerprintExcludingAllowedProductDeleteTables(fingerprint) {
  const clone = normalizeNonSessionFingerprint(fingerprint);
  delete clone.tableStates.products;
  delete clone.tableStates.product_variants;
  delete clone.tableStates.variant_recipe_items;
  delete clone.tableStates.variant_availability_summaries;
  delete clone.tableStates.variant_availability_events;
  return clone;
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

  async request(method, pathName, options = {}) {
    const started = Date.now();
    const headers = { ...(options.headers ?? {}) };
    if (this.cookieHeader) {
      headers.Cookie = this.cookieHeader;
    }
    if (options.json !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${this.baseUrl}${pathName}`, {
      method,
      headers,
      body:
        options.json !== undefined ? JSON.stringify(options.json) : options.body,
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

function assertNoSecretsInBody(body) {
  if (!body || typeof body !== 'object') {
    return;
  }

  assert.equal('sessionToken' in body, false);
  assert.equal('token' in body, false);
  assert.equal(JSON.stringify(body).includes('SELECT '), false);
}

function assertProductDetailContract(body) {
  assert(body && typeof body === 'object');
  assert.equal(typeof body.id, 'string');
  assert.equal(typeof body.name, 'string');
  assert(body.category && typeof body.category.id === 'string');
  assert.equal(typeof body.manualAvailability, 'boolean');
  assert(body.archive && typeof body.archive === 'object');
  assert.equal(Array.isArray(body.variants), true);
}

async function getProductInventory() {
  const products = await prisma.product.findMany({
    where: {
      OR: [
        { name: { startsWith: 'PBT2_' } },
        { name: { startsWith: 'PBT3_' } },
        { name: { startsWith: 'PBT4_' } },
      ],
    },
    include: {
      category: true,
      variants: {
        include: {
          recipeItems: true,
          availabilitySummary: true,
          availabilityEvents: true,
          stockoutEvents: true,
          _count: {
            select: {
              orderItems: true,
              transactionLines: true,
            },
          },
        },
        orderBy: { sku: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  return products.map((product) => {
    const orderItemCount = product.variants.reduce(
      (sum, variant) => sum + variant._count.orderItems,
      0,
    );
    const ledgerCount = product.variants.reduce(
      (sum, variant) => sum + variant._count.transactionLines,
      0,
    );
    const stockoutEventCount = product.variants.reduce(
      (sum, variant) => sum + variant.stockoutEvents.length,
      0,
    );
    const availabilityEventCount = product.variants.reduce(
      (sum, variant) => sum + variant.availabilityEvents.length,
      0,
    );
    const recipeCount = product.variants.reduce(
      (sum, variant) => sum + variant.recipeItems.length,
      0,
    );

    let classification = 'UNCLEAR_DO_NOT_DELETE';
    if (
      product.name.startsWith('PBT') &&
      orderItemCount === 0 &&
      ledgerCount === 0 &&
      stockoutEventCount === 0
    ) {
      classification = 'SAFE_DELETE';
    } else if (
      orderItemCount > 0 ||
      ledgerCount > 0 ||
      stockoutEventCount > 0
    ) {
      classification = 'BLOCKED_REAL_HISTORY';
    }

    return {
      productId: product.id,
      name: product.name,
      category: product.category.name,
      isArchived: product.archivedAt !== null,
      isEnabled: product.isEnabled,
      variantCount: product.variants.length,
      recipeCount,
      availabilitySummaryCount: product.variants.filter(
        (variant) => variant.availabilitySummary,
      ).length,
      availabilityEventCount,
      stockoutEventCount,
      orderItemCount,
      ledgerCount,
      classification,
      variants: product.variants.map((variant) => ({
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        name: variant.name,
        sku: variant.sku,
        recipeRows: variant.recipeItems.length,
        orderCount: variant._count.orderItems,
        ledgerCount: variant._count.transactionLines,
        stockoutCount: variant.stockoutEvents.length,
        availabilityEventCount: variant.availabilityEvents.length,
        safe:
          product.name.startsWith('PBT') &&
          variant._count.orderItems === 0 &&
          variant._count.transactionLines === 0 &&
          variant.stockoutEvents.length === 0,
      })),
    };
  });
}

async function getVariantDeletionSnapshot(variantId) {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      recipeItems: true,
      availabilitySummary: true,
      availabilityEvents: true,
      stockoutEvents: true,
      orderItems: { select: { id: true } },
      transactionLines: { select: { id: true } },
      product: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!variant) {
    return null;
  }

  return {
    variantId: variant.id,
    productId: variant.productId,
    productName: variant.product.name,
    recipeRowCount: variant.recipeItems.length,
    summaryRowCount: variant.availabilitySummary ? 1 : 0,
    availabilityEventCount: variant.availabilityEvents.length,
    orderCount: variant.orderItems.length,
    ledgerCount: variant.transactionLines.length,
    stockoutCount: variant.stockoutEvents.length,
  };
}

async function getProductDeletionSnapshot(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: {
        include: {
          recipeItems: true,
          availabilitySummary: true,
          availabilityEvents: true,
          stockoutEvents: true,
          orderItems: { select: { id: true } },
          transactionLines: { select: { id: true } },
        },
        orderBy: { sku: 'asc' },
      },
    },
  });

  if (!product) {
    return null;
  }

  return {
    productId: product.id,
    productName: product.name,
    variantIds: product.variants.map((variant) => variant.id),
    recipeRowCount: product.variants.reduce(
      (sum, variant) => sum + variant.recipeItems.length,
      0,
    ),
    summaryRowCount: product.variants.filter((variant) => variant.availabilitySummary)
      .length,
    availabilityEventCount: product.variants.reduce(
      (sum, variant) => sum + variant.availabilityEvents.length,
      0,
    ),
    orderCount: product.variants.reduce(
      (sum, variant) => sum + variant.orderItems.length,
      0,
    ),
    ledgerCount: product.variants.reduce(
      (sum, variant) => sum + variant.transactionLines.length,
      0,
    ),
    stockoutCount: product.variants.reduce(
      (sum, variant) => sum + variant.stockoutEvents.length,
      0,
    ),
  };
}

function summarizeRemainingInventory(products) {
  return products.map((product) => ({
    productId: product.productId,
    name: product.name,
    classification: product.classification,
    orderItemCount: product.orderItemCount,
    ledgerCount: product.ledgerCount,
    stockoutEventCount: product.stockoutEventCount,
    availabilityEventCount: product.availabilityEventCount,
  }));
}

function writeArtifact(summary) {
  const dir = path.join(
    __dirname,
    '..',
    'backups',
    'phase4_final_runtime_artifacts',
  );
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'phase4_final_runner_output.json');
  fs.writeFileSync(file, JSON.stringify(summary, null, 2));
  return file;
}

async function run() {
  const baseUrl = process.env.PHASE4_BASE_URL ?? 'http://127.0.0.1:4100';
  const roleInputs = {
    staff: {
      email: process.env.PHASE4_STAFF_EMAIL ?? 'staff@stockscout.com',
      password: process.env.PHASE4_STAFF_PASSWORD ?? 'staff123',
      userId: '77b76a40-8344-4469-8000-a7aa7066da25',
    },
    admin: {
      email: process.env.PHASE4_ADMIN_EMAIL ?? 'admin@stockscout.com',
      password: process.env.PHASE4_ADMIN_PASSWORD ?? 'admin123',
      userId: '755481e6-a252-49cb-a73e-34657841edb3',
    },
    secondaryAdmin: {
      email: process.env.PHASE4_SECONDARY_ADMIN_EMAIL ?? 'sysadmin@stockscout.com',
      password: process.env.PHASE4_SECONDARY_ADMIN_PASSWORD ?? 'sysadmin123',
      userId: 'f8868ca6-644d-407c-917e-db160746a3da',
    },
  };

  const summary = {
    baseUrl,
    baselineFingerprint: await getFingerprint(),
    initialInventory: await getProductInventory(),
    authSessions: [],
    roleAccessResults: [],
    historicalControl: null,
    variantDelete: null,
    productDelete: null,
    cleanupDeletes: [],
    finalInventory: null,
    finalFingerprint: null,
  };

  const baselineStrict = normalizeNonSessionFingerprint(summary.baselineFingerprint);

  const safeProducts = summary.initialInventory.filter(
    (product) => product.classification === 'SAFE_DELETE',
  );
  assert(safeProducts.length >= 3, 'expected at least three SAFE_DELETE PBT products');

  const variantDeleteParent =
    safeProducts.find(
      (product) =>
        product.productId === PREFERRED_VARIANT_DELETE_PARENT_ID &&
        product.variants.length >= 2,
    ) ??
    safeProducts.find(
      (product) =>
        product.productId !== PRIMARY_PRODUCT_DELETE_ID &&
        product.variants.length >= 2,
    );
  assert(variantDeleteParent, 'variant delete parent product must exist');
  const variantCandidate = variantDeleteParent.variants.find(
    (variant) => variant.safe,
  );
  assert(variantCandidate, 'variant delete candidate must exist');

  const productDeleteCandidate = safeProducts.find(
    (product) => product.productId === PRIMARY_PRODUCT_DELETE_ID,
  );
  assert(productDeleteCandidate, 'primary product delete candidate must exist');

  async function assertFingerprint(stage, normalizer, expected) {
    const current = normalizer(await getFingerprint());
    const match = JSON.stringify(current) === JSON.stringify(expected);
    assert.equal(match, true, `unexpected database drift at ${stage}`);
  }

  async function loginAs(roleLabel) {
    const input = roleInputs[roleLabel];
    const client = new SessionClient(baseUrl);
    const beforeSessions = await getUserSessions(input.userId);
    const beforeUser = (await getUsersState([input.userId]))[0];

    const response = await client.request('POST', '/auth/login', {
      json: {
        email: input.email,
        password: input.password,
      },
    });

    assert.equal(response.status, 201, `${roleLabel} login must succeed`);
    assertNoSecretsInBody(response.body);

    const afterSessions = await getUserSessions(input.userId);
    const afterUser = (await getUsersState([input.userId]))[0];
    const newSessions = afterSessions.filter(
      (session) => !beforeSessions.some((before) => before.id === session.id),
    );

    assert.equal(newSessions.length, 1, `${roleLabel} login must create one session`);
    assert.equal(afterUser.role, beforeUser.role);
    assert.equal(afterUser.isActive, beforeUser.isActive);

    summary.authSessions.push({
      role: roleLabel,
      sessionId: newSessions[0].id,
      createdAt: newSessions[0].createdAt,
      lastSeenAt: newSessions[0].lastSeenAt,
      idleExpiresAt: newSessions[0].idleExpiresAt,
      revokedAt: newSessions[0].revokedAt,
    });

    return {
      client,
      sessionId: newSessions[0].id,
      userId: input.userId,
    };
  }

  async function logoutRole(roleLabel, client, sessionId) {
    const response = await client.request('POST', '/auth/logout');
    assert.equal(response.status, 201, `${roleLabel} logout must succeed`);
    const sessions = await getUserSessions(roleInputs[roleLabel].userId);
    const session = sessions.find((row) => row.id === sessionId);
    assert(session && session.revokedAt, `${roleLabel} session must be revoked`);
  }

  const unauthenticated = new SessionClient(baseUrl);
  const staff = await loginAs('staff');
  const admin = await loginAs('admin');
  const secondaryAdmin = await loginAs('secondaryAdmin');

  await assertFingerprint('post-login', normalizeNonSessionFingerprint, baselineStrict);

  const historicalEligibility = await admin.client.request(
    'GET',
    `/admin/products/${HISTORICAL_PRODUCT_ID}/delete-eligibility`,
  );
  assert.equal(historicalEligibility.status, 200);
  assert.equal(historicalEligibility.body.eligible, false);
  assert.equal(
    historicalEligibility.body.blockingReasons.some(
      (reason) => reason.code === 'HAS_ORDER_HISTORY',
    ),
    true,
  );
  assert.equal(
    historicalEligibility.body.blockingReasons.some(
      (reason) => reason.code === 'HAS_LEDGER_HISTORY',
    ),
    true,
  );

  const blockedHistoricalDelete = await admin.client.request(
    'DELETE',
    `/admin/products/${HISTORICAL_PRODUCT_ID}`,
  );
  assert.equal(blockedHistoricalDelete.status, 409);
  assert.equal(
    sanitizeMessage(blockedHistoricalDelete.body?.message),
    'Product is not eligible for permanent delete',
  );
  await assertFingerprint(
    'historical-blocked-delete',
    normalizeNonSessionFingerprint,
    baselineStrict,
  );

  summary.historicalControl = {
    productId: HISTORICAL_PRODUCT_ID,
    eligibility: historicalEligibility.body,
    blockedDeleteStatus: blockedHistoricalDelete.status,
    blockedDeleteMessage: sanitizeMessage(blockedHistoricalDelete.body?.message),
  };

  const unauthVariantDelete = await unauthenticated.request(
    'DELETE',
    `/admin/variants/${variantCandidate.variantId}`,
  );
  assert.equal(unauthVariantDelete.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id',
    role: 'unauthenticated',
    status: unauthVariantDelete.status,
  });
  await assertFingerprint(
    'unauth-variant-delete',
    normalizeNonSessionFingerprint,
    baselineStrict,
  );

  const staffVariantDelete = await staff.client.request(
    'DELETE',
    `/admin/variants/${variantCandidate.variantId}`,
  );
  assert.equal(staffVariantDelete.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id',
    role: 'staff',
    status: staffVariantDelete.status,
  });
  await assertFingerprint(
    'staff-variant-delete',
    normalizeNonSessionFingerprint,
    baselineStrict,
  );

  const variantBefore = await getVariantDeletionSnapshot(variantCandidate.variantId);
  assert(variantBefore, 'variant candidate must exist before deletion');

  const variantDeleteBaseline = await getFingerprint();
  const variantDeleteResponse = await admin.client.request(
    'DELETE',
    `/admin/variants/${variantCandidate.variantId}`,
  );
  assert.equal(variantDeleteResponse.status, 200);
  assertProductDetailContract(variantDeleteResponse.body);
  assert.equal(variantDeleteResponse.body.id, variantDeleteParent.productId);
  assert.equal(
    variantDeleteResponse.body.variants.some(
      (variant) => variant.id === variantCandidate.variantId,
    ),
    false,
  );
  assert.equal(variantDeleteResponse.body.variantCount >= 1, true);

  const variantAfter = await getVariantDeletionSnapshot(variantCandidate.variantId);
  assert.equal(variantAfter, null);
  const remainingParent = await prisma.product.findUnique({
    where: { id: variantDeleteParent.productId },
    include: {
      variants: true,
    },
  });
  assert(remainingParent, 'parent product must remain after variant delete');
  assert.equal(
    remainingParent.variants.some((variant) => variant.id === variantCandidate.variantId),
    false,
  );

  await assertFingerprint(
    'variant-delete-disallowed',
    normalizeFingerprintExcludingAllowedVariantDeleteTables,
    normalizeFingerprintExcludingAllowedVariantDeleteTables(variantDeleteBaseline),
  );

  const repeatedVariantDeleteBaseline = await getFingerprint();
  const repeatedVariantDelete = await admin.client.request(
    'DELETE',
    `/admin/variants/${variantCandidate.variantId}`,
  );
  assert.equal(repeatedVariantDelete.status, 404);
  await assertFingerprint(
    'variant-delete-repeat',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(repeatedVariantDeleteBaseline),
  );

  summary.roleAccessResults.push({
    route: '/admin/variants/:id',
    role: 'admin',
    status: variantDeleteResponse.status,
  });
  summary.variantDelete = {
    target: variantBefore,
    responseStatus: variantDeleteResponse.status,
    repeatStatus: repeatedVariantDelete.status,
    parentProductId: variantDeleteParent.productId,
    remainingSiblingVariantIds: remainingParent.variants.map((variant) => variant.id),
  };

  const postVariantDeleteStrict = normalizeNonSessionFingerprint(
    await getFingerprint(),
  );

  const unauthProductDelete = await unauthenticated.request(
    'DELETE',
    `/admin/products/${productDeleteCandidate.productId}`,
  );
  assert.equal(unauthProductDelete.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/products/:id',
    role: 'unauthenticated',
    status: unauthProductDelete.status,
  });
  await assertFingerprint(
    'unauth-product-delete',
    normalizeNonSessionFingerprint,
    postVariantDeleteStrict,
  );

  const staffProductDelete = await staff.client.request(
    'DELETE',
    `/admin/products/${productDeleteCandidate.productId}`,
  );
  assert.equal(staffProductDelete.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/products/:id',
    role: 'staff',
    status: staffProductDelete.status,
  });
  await assertFingerprint(
    'staff-product-delete',
    normalizeNonSessionFingerprint,
    postVariantDeleteStrict,
  );

  const productEligibility = await secondaryAdmin.client.request(
    'GET',
    `/admin/products/${productDeleteCandidate.productId}/delete-eligibility`,
  );
  assert.equal(productEligibility.status, 200);
  assert.equal(productEligibility.body.eligible, true);

  const productBefore = await getProductDeletionSnapshot(productDeleteCandidate.productId);
  assert(productBefore, 'product delete candidate must exist');
  assert.equal(productBefore.orderCount, 0);
  assert.equal(productBefore.ledgerCount, 0);
  assert.equal(productBefore.stockoutCount, 0);

  const productDeleteBaseline = await getFingerprint();
  const productDeleteResponse = await secondaryAdmin.client.request(
    'DELETE',
    `/admin/products/${productDeleteCandidate.productId}`,
  );
  assert.equal(productDeleteResponse.status, 200);
  assert.equal(productDeleteResponse.body.deleted, true);
  assert.equal(productDeleteResponse.body.productId, productDeleteCandidate.productId);

  const productAfter = await getProductDeletionSnapshot(productDeleteCandidate.productId);
  assert.equal(productAfter, null);

  const childVariantCountAfter = await prisma.productVariant.count({
    where: { id: { in: productBefore.variantIds } },
  });
  assert.equal(childVariantCountAfter, 0);

  await assertFingerprint(
    'product-delete-disallowed',
    normalizeFingerprintExcludingAllowedProductDeleteTables,
    normalizeFingerprintExcludingAllowedProductDeleteTables(productDeleteBaseline),
  );

  const repeatedProductDeleteBaseline = await getFingerprint();
  const repeatedProductDelete = await secondaryAdmin.client.request(
    'DELETE',
    `/admin/products/${productDeleteCandidate.productId}`,
  );
  assert.equal(repeatedProductDelete.status, 404);
  await assertFingerprint(
    'product-delete-repeat',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(repeatedProductDeleteBaseline),
  );

  summary.roleAccessResults.push({
    route: '/admin/products/:id',
    role: 'secondary-admin',
    status: productDeleteResponse.status,
  });
  summary.productDelete = {
    target: productBefore,
    eligibility: productEligibility.body,
    responseStatus: productDeleteResponse.status,
    repeatStatus: repeatedProductDelete.status,
  };

  let inventoryAfterTargetDeletes = await getProductInventory();
  const cleanupCandidates = inventoryAfterTargetDeletes.filter(
    (product) => product.classification === 'SAFE_DELETE',
  );

  for (const product of cleanupCandidates) {
    const eligibility = await admin.client.request(
      'GET',
      `/admin/products/${product.productId}/delete-eligibility`,
    );
    assert.equal(eligibility.status, 200);
    assert.equal(eligibility.body.eligible, true);

    const before = await getProductDeletionSnapshot(product.productId);
    assert(before, 'cleanup product must exist before delete');
    assert.equal(before.orderCount, 0);
    assert.equal(before.ledgerCount, 0);
    assert.equal(before.stockoutCount, 0);

    const baseline = await getFingerprint();
    const response = await admin.client.request(
      'DELETE',
      `/admin/products/${product.productId}`,
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.deleted, true);

    const after = await getProductDeletionSnapshot(product.productId);
    assert.equal(after, null);

    await assertFingerprint(
      `cleanup-${product.productId}`,
      normalizeFingerprintExcludingAllowedProductDeleteTables,
      normalizeFingerprintExcludingAllowedProductDeleteTables(baseline),
    );

    summary.cleanupDeletes.push({
      productId: product.productId,
      productName: product.name,
      childVariantIds: before.variantIds,
      recipeRowCount: before.recipeRowCount,
      availabilityEventCount: before.availabilityEventCount,
      responseStatus: response.status,
    });
  }

  inventoryAfterTargetDeletes = await getProductInventory();
  summary.finalInventory = summarizeRemainingInventory(inventoryAfterTargetDeletes);
  summary.finalFingerprint = await getFingerprint();

  await logoutRole('staff', staff.client, staff.sessionId);
  await logoutRole('admin', admin.client, admin.sessionId);
  await logoutRole('secondaryAdmin', secondaryAdmin.client, secondaryAdmin.sessionId);

  const artifactPath = writeArtifact(summary);
  console.log(
    JSON.stringify(
      {
        artifactPath,
        summary,
      },
      null,
      2,
    ),
  );
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
