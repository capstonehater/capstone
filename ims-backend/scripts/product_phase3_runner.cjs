const assert = require('node:assert/strict');
const { loadEnvFile } = require('node:process');
const { PrismaClient } = require('@prisma/client');

loadEnvFile();

const prisma = new PrismaClient();

const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';
const FIXTURE_PRODUCT_ID = '14b6867c-87c1-4db1-8eaa-5b0fcbfc6e6a';
const REGULAR_VARIANT_ID = 'e107200e-a5d7-4a4e-806d-959d58a08efd';
const LARGE_VARIANT_ID = '0f103840-d5c7-4e99-a489-64d3b59f19c3';

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
    stock_batches: await latest(
      'stock_batches',
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
  };

  const [productCounts, variantCounts, recipeRowCount] = await Promise.all([
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
  ]);

  return {
    tableStates,
    aggregates: {
      productCount: tableStates.products.count,
      variantCount: tableStates.product_variants.count,
      archivedProductCount: productCounts[0].archived_count,
      enabledProductCount: productCounts[0].enabled_count,
      disabledProductCount: productCounts[0].disabled_count,
      enabledVariantCount: variantCounts[0].enabled_count,
      disabledVariantCount: variantCounts[0].disabled_count,
      availabilityEventCount: tableStates.variant_availability_events.count,
      variantSummaryCount: tableStates.variant_availability_summaries.count,
      recipeRowCount,
      existingSessionCount: tableStates.auth_sessions.count,
    },
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeNonSessionFingerprint(fingerprint) {
  const clone = cloneJson(fingerprint);
  delete clone.tableStates.users;
  delete clone.tableStates.auth_sessions;
  delete clone.aggregates.existingSessionCount;
  return clone;
}

function normalizeFingerprintExcludingAllowedMutationTables(fingerprint) {
  const clone = normalizeNonSessionFingerprint(fingerprint);

  delete clone.tableStates.product_variants;
  delete clone.tableStates.variant_recipe_items;
  delete clone.tableStates.variant_availability_summaries;
  delete clone.tableStates.variant_availability_events;

  delete clone.aggregates.variantCount;
  delete clone.aggregates.enabledVariantCount;
  delete clone.aggregates.disabledVariantCount;
  delete clone.aggregates.availabilityEventCount;
  delete clone.aggregates.variantSummaryCount;
  delete clone.aggregates.recipeRowCount;

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
  assert.equal(typeof body.variantCount, 'number');
  assert.equal(typeof body.ingredientCount, 'number');
  assert(body.deleteEligibility && typeof body.deleteEligibility.eligible === 'boolean');
  assert.equal(Array.isArray(body.deleteEligibility.blockingReasons), true);

  for (const variant of body.variants) {
    assert.equal(typeof variant.id, 'string');
    assert.equal(typeof variant.name, 'string');
    assert.equal(typeof variant.sku, 'string');
    assert.equal(typeof variant.price, 'string');
    assert.equal(typeof variant.manualAvailability, 'boolean');
    assert.equal(typeof variant.isInStock, 'boolean');
    assert.equal(typeof variant.isSellable, 'boolean');
    assert.equal(typeof variant.availableBaseQty, 'number');
    assert.equal(typeof variant.blockingReason, 'string');
    assert.equal(typeof variant.ingredientCount, 'number');
    assert(variant.recipeSummary && typeof variant.recipeSummary.itemCount === 'number');
    assert.equal(Array.isArray(variant.recipeSummary.items), true);
  }
}

function assertRecipeContract(body) {
  assert(body && typeof body === 'object');
  assert.equal(typeof body.productId, 'string');
  assert.equal(typeof body.productName, 'string');
  assert.equal(typeof body.variantId, 'string');
  assert.equal(typeof body.variantName, 'string');
  assert.equal(Array.isArray(body.items), true);

  for (const item of body.items) {
    assert.equal(typeof item.rawMaterialId, 'string');
    assert.equal(typeof item.rawMaterialName, 'string');
    assert.equal(typeof item.quantity, 'string');
    assert(item.unit && typeof item.unit.id === 'string');
  }
}

function parseLatestTimestamp(value, label) {
  assert(value, `${label} latest timestamp is required`);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(value.replace(' ', 'T') + 'Z');
  }

  return new Date(value);
}

async function getVariantSnapshot(variantId) {
  return prisma.productVariant.findUnique({
    where: { id: variantId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          isEnabled: true,
          archivedAt: true,
        },
      },
      availabilitySummary: true,
      recipeItems: {
        include: {
          rawMaterial: {
            include: {
              unit: true,
              summary: true,
            },
          },
        },
        orderBy: [{ rawMaterial: { name: 'asc' } }],
      },
      orderItems: {
        select: { id: true },
      },
      transactionLines: {
        select: { id: true },
      },
      availabilityEvents: {
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
      },
    },
  });
}

async function getRetainedProductSnapshot() {
  const product = await prisma.product.findUnique({
    where: { id: FIXTURE_PRODUCT_ID },
    include: {
      category: true,
      variants: {
        include: {
          availabilitySummary: true,
          recipeItems: true,
          orderItems: { select: { id: true } },
          transactionLines: { select: { id: true } },
          availabilityEvents: { select: { id: true } },
        },
        orderBy: { sku: 'asc' },
      },
    },
  });

  assert(product, 'retained product must exist');
  return product;
}

async function getTrackedMaterialSnapshots(ids) {
  const rows = await prisma.rawMaterial.findMany({
    where: { id: { in: ids } },
    include: {
      unit: true,
      summary: true,
    },
    orderBy: { id: 'asc' },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    unit: row.unit.code,
    onHandQuantity: row.summary?.onHandQuantity?.toString() ?? null,
    usableQuantity: row.summary?.usableQuantity?.toString() ?? null,
    activeBatchCount: row.summary?.activeBatchCount ?? null,
    nearestExpiryDate: formatDate(row.summary?.nearestExpiryDate),
    updatedAt: formatDate(row.summary?.updatedAt),
  }));
}

async function getChangedVariantsSince(baselineLatest) {
  return prisma.productVariant.findMany({
    where: {
      OR: [{ createdAt: { gt: baselineLatest } }, { updatedAt: { gt: baselineLatest } }],
    },
    select: {
      id: true,
      productId: true,
      name: true,
      sku: true,
      isEnabled: true,
      updatedAt: true,
    },
    orderBy: { id: 'asc' },
  });
}

async function getChangedVariantSummariesSince(baselineLatest) {
  return prisma.variantAvailabilitySummary.findMany({
    where: { updatedAt: { gt: baselineLatest } },
    select: {
      productVariantId: true,
      isInStock: true,
      isSellable: true,
      availableBaseQty: true,
      blockingReason: true,
      updatedAt: true,
    },
    orderBy: { productVariantId: 'asc' },
  });
}

async function getFixtureVariantEvents(variantIds) {
  return prisma.variantAvailabilityEvent.findMany({
    where: {
      productVariantId: { in: variantIds },
    },
    select: {
      id: true,
      productVariantId: true,
      previousIsSellable: true,
      newIsSellable: true,
      previousBlockingReason: true,
      blockingReason: true,
      availableBaseQty: true,
      occurredAt: true,
      createdAt: true,
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  });
}

async function getFixtureRecipeRows(variantIds) {
  return prisma.variantRecipeItem.findMany({
    where: {
      productVariantId: { in: variantIds },
    },
    select: {
      id: true,
      productVariantId: true,
      rawMaterialId: true,
      quantity: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ productVariantId: 'asc' }, { rawMaterialId: 'asc' }],
  });
}

async function selectCandidateMaterials() {
  const activeUsable = await prisma.rawMaterial.findMany({
    where: {
      isActive: true,
      summary: {
        usableQuantity: {
          gt: 0,
        },
      },
    },
    include: {
      unit: true,
      summary: true,
    },
    orderBy: [{ name: 'asc' }],
  });

  const inactive = await prisma.rawMaterial.findFirst({
    where: { isActive: false },
    include: {
      unit: true,
      summary: true,
    },
    orderBy: [{ name: 'asc' }],
  });

  assert(activeUsable.length >= 2, 'at least two active raw materials with usable stock are required');
  assert(inactive, 'at least one inactive raw material is required');

  const primary = activeUsable.find((item) => item.name === 'Chocolate Powder') ?? activeUsable[0];
  const secondary = activeUsable.find((item) => item.id !== primary.id) ?? activeUsable[1];

  assert(primary.summary?.usableQuantity?.greaterThan(0), 'primary usable material must have stock');
  assert(secondary.summary?.usableQuantity?.greaterThan(0), 'secondary usable material must have stock');

  return {
    primary: {
      id: primary.id,
      name: primary.name,
      unit: primary.unit.code,
      usableQuantity: primary.summary.usableQuantity.toString(),
    },
    secondary: {
      id: secondary.id,
      name: secondary.name,
      unit: secondary.unit.code,
      usableQuantity: secondary.summary.usableQuantity.toString(),
    },
    inactive: {
      id: inactive.id,
      name: inactive.name,
      unit: inactive.unit.code,
      usableQuantity: inactive.summary?.usableQuantity?.toString() ?? '0',
    },
  };
}

function findVariant(detail, variantId) {
  const variant = detail.variants.find((item) => item.id === variantId);
  assert(variant, `variant ${variantId} must be present in product detail`);
  return variant;
}

async function runPhase3() {
  const baseUrl = process.env.PHASE3_BASE_URL ?? 'http://127.0.0.1:4100';
  const roleInputs = {
    staff: {
      email: process.env.PHASE3_STAFF_EMAIL ?? 'staff@stockscout.com',
      password: process.env.PHASE3_STAFF_PASSWORD ?? 'staff123',
      userId: '77b76a40-8344-4469-8000-a7aa7066da25',
    },
    admin: {
      email: process.env.PHASE3_ADMIN_EMAIL ?? 'admin@stockscout.com',
      password: process.env.PHASE3_ADMIN_PASSWORD ?? 'admin123',
      userId: '755481e6-a252-49cb-a73e-34657841edb3',
    },
    secondaryAdmin: {
      email: process.env.PHASE3_SECONDARY_ADMIN_EMAIL ?? 'sysadmin@stockscout.com',
      password: process.env.PHASE3_SECONDARY_ADMIN_PASSWORD ?? 'sysadmin123',
      userId: 'f8868ca6-644d-407c-917e-db160746a3da',
    },
  };

  const routeMatrix = [
    {
      operation: 'createVariant',
      method: 'POST',
      route: '/admin/products/:id/variants',
      requiredRole: 'ADMINISTRATOR',
      dto: 'CreateProductVariantDto',
    },
    {
      operation: 'updateVariant',
      method: 'PATCH',
      route: '/admin/variants/:id',
      requiredRole: 'ADMINISTRATOR',
      dto: 'UpdateProductVariantDto',
    },
    {
      operation: 'setVariantManualAvailability',
      method: 'PATCH',
      route: '/admin/variants/:id/manual-availability',
      requiredRole: 'ADMINISTRATOR',
      dto: 'SetManualAvailabilityDto',
    },
    {
      operation: 'getVariantRecipe',
      method: 'GET',
      route: '/admin/variants/:id/recipe',
      requiredRole: 'ADMINISTRATOR',
      dto: 'none',
    },
    {
      operation: 'replaceVariantRecipe',
      method: 'PUT',
      route: '/admin/variants/:id/recipe',
      requiredRole: 'ADMINISTRATOR',
      dto: 'ReplaceVariantRecipeDto',
    },
  ];

  const trackedUserIds = Object.values(roleInputs).map((input) => input.userId);
  const baselineFingerprint = await getFingerprint();
  const baselineStrict = normalizeNonSessionFingerprint(baselineFingerprint);
  const baselineDisallowed = normalizeFingerprintExcludingAllowedMutationTables(
    baselineFingerprint,
  );
  const baselineLatestDates = {
    variants: parseLatestTimestamp(
      baselineFingerprint.tableStates.product_variants.latest,
      'product_variants',
    ),
    variantSummaries: parseLatestTimestamp(
      baselineFingerprint.tableStates.variant_availability_summaries.latest,
      'variant_availability_summaries',
    ),
  };

  const initialUsers = await getUsersState(trackedUserIds);
  const initialFixture = await getRetainedProductSnapshot();
  const candidateMaterials = await selectCandidateMaterials();
  const trackedMaterialsBefore = await getTrackedMaterialSnapshots([
    candidateMaterials.primary.id,
    candidateMaterials.secondary.id,
    candidateMaterials.inactive.id,
  ]);

  assert.equal(initialFixture.id, FIXTURE_PRODUCT_ID);
  assert.equal(initialFixture.name, 'PBT2_Product_20260808171522_Sys');
  assert.equal(initialFixture.archivedAt, null);
  assert.equal(initialFixture.isEnabled, true);
  assert.equal(initialFixture.variants.length, 2);
  assert.equal(
    initialFixture.variants.every((variant) => variant.recipeItems.length === 0),
    true,
  );
  assert.equal(
    initialFixture.variants.every(
      (variant) =>
        variant.availabilitySummary &&
        variant.availabilitySummary.isInStock === false &&
        variant.availabilitySummary.isSellable === false &&
        variant.availabilitySummary.availableBaseQty === 0 &&
        variant.availabilitySummary.blockingReason === 'NO_RECIPE',
    ),
    true,
  );

  const summary = {
    routeMatrix,
    baselineFingerprint,
    initialUsers,
    initialFixture: {
      productId: initialFixture.id,
      productName: initialFixture.name,
      variantIds: initialFixture.variants.map((variant) => variant.id),
      recipeRowCount: initialFixture.variants.reduce(
        (sum, variant) => sum + variant.recipeItems.length,
        0,
      ),
    },
    candidateMaterials,
    trackedMaterialsBefore,
    roleAccessResults: [],
    validationResults: [],
    mutationResults: [],
    driftChecks: [],
    httpReview: [],
    authSessions: [],
    fixture: null,
  };

  async function assertFingerprintMatch(stage, normalizer, expected) {
    const current = normalizer(await getFingerprint());
    const match = JSON.stringify(current) === JSON.stringify(expected);
    summary.driftChecks.push({ stage, match });
    assert.equal(match, true, `unexpected database drift detected at ${stage}`);
  }

  async function assertNoDisallowedDrift(stage) {
    await assertFingerprintMatch(
      stage,
      normalizeFingerprintExcludingAllowedMutationTables,
      baselineDisallowed,
    );
  }

  async function assertNoSecretsAndTrack(response, endpoint, role) {
    assertNoSecretsInBody(response.body);
    summary.httpReview.push({
      endpoint,
      role,
      status: response.status,
      elapsedMs: response.elapsedMs,
      message: sanitizeMessage(response.body?.message),
    });
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

    assert.equal(newSessions.length, 1, `${roleLabel} login must create exactly one session`);
    assert.equal(afterUser.role, beforeUser.role);
    assert.equal(afterUser.isActive, beforeUser.isActive);
    await assertNoDisallowedDrift(`${roleLabel}-login`);

    summary.authSessions.push({
      role: roleLabel,
      sessionId: newSessions[0].id,
      createdAt: newSessions[0].createdAt,
      lastSeenAt: newSessions[0].lastSeenAt,
      idleExpiresAt: newSessions[0].idleExpiresAt,
      revokedAt: newSessions[0].revokedAt,
      userLastLoginAtBefore: beforeUser.lastLoginAt,
      userLastLoginAtAfter: afterUser.lastLoginAt,
      userUpdatedAtAfter: afterUser.updatedAt,
    });

    return { client, sessionId: newSessions[0].id };
  }

  async function logoutRole(roleLabel, client, sessionId) {
    const response = await client.request('POST', '/auth/logout');
    assert.equal(response.status, 201, `${roleLabel} logout must succeed`);
    await assertNoDisallowedDrift(`${roleLabel}-logout`);
    const sessions = await getUserSessions(roleInputs[roleLabel].userId);
    const session = sessions.find((row) => row.id === sessionId);
    assert(session && session.revokedAt, `${roleLabel} session must be revoked`);
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const createdVariantName = `PBT3 Variant ${timestamp}`;
  const createdVariantSku = `PBT3-SKU-${timestamp}`;
  const updatedVariantName = `PBT3 Variant ${timestamp} Admin`;
  const finalVariantName = `PBT3 Variant ${timestamp} Sys`;
  const updatedVariantSku = `PBT3-SKU-${timestamp}-A`;
  const finalVariantSku = `PBT3-SKU-${timestamp}-S`;

  const unauthenticated = new SessionClient(baseUrl);
  const staff = await loginAs('staff');
  const admin = await loginAs('admin');
  const secondaryAdmin = await loginAs('secondaryAdmin');

  const regularRecipeBefore = await admin.client.request(
    'GET',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
  );
  await assertNoSecretsAndTrack(
    regularRecipeBefore,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'admin',
  );
  assert.equal(regularRecipeBefore.status, 200);
  assertRecipeContract(regularRecipeBefore.body);
  assert.equal(regularRecipeBefore.body.items.length, 0);
  await assertNoDisallowedDrift('admin-get-initial-recipe');

  const unauthCreate = await unauthenticated.request(
    'POST',
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    {
      json: {
        name: createdVariantName,
        sku: createdVariantSku,
        price: '120.00',
        isEnabled: true,
      },
    },
  );
  await assertNoSecretsAndTrack(
    unauthCreate,
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    'unauthenticated',
  );
  assert.equal(unauthCreate.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/variants',
    role: 'unauthenticated',
    status: unauthCreate.status,
  });
  await assertNoDisallowedDrift('unauth-create-variant');

  const staffCreate = await staff.client.request(
    'POST',
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    {
      json: {
        name: createdVariantName,
        sku: createdVariantSku,
        price: '120.00',
        isEnabled: true,
      },
    },
  );
  await assertNoSecretsAndTrack(
    staffCreate,
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    'staff',
  );
  assert.equal(staffCreate.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/variants',
    role: 'staff',
    status: staffCreate.status,
  });
  await assertNoDisallowedDrift('staff-create-variant');

  const unknownProductCreate = await admin.client.request(
    'POST',
    `/admin/products/${UNKNOWN_ID}/variants`,
    {
      json: {
        name: `${createdVariantName} Missing`,
        sku: `${createdVariantSku}-MISSING`,
        price: '120.00',
        isEnabled: true,
      },
    },
  );
  await assertNoSecretsAndTrack(
    unknownProductCreate,
    `/admin/products/${UNKNOWN_ID}/variants`,
    'admin',
  );
  assert.equal(unknownProductCreate.status, 404);
  summary.validationResults.push({
    case: 'create-variant-unknown-product',
    status: unknownProductCreate.status,
    message: sanitizeMessage(unknownProductCreate.body?.message),
  });
  await assertNoDisallowedDrift('create-variant-unknown-product');

  const adminCreate = await admin.client.request(
    'POST',
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    {
      json: {
        name: createdVariantName,
        sku: createdVariantSku,
        price: '120.00',
        isEnabled: true,
      },
    },
  );
  await assertNoSecretsAndTrack(
    adminCreate,
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    'admin',
  );
  assert.equal(adminCreate.status, 201);
  assertProductDetailContract(adminCreate.body);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/variants',
    role: 'admin',
    status: adminCreate.status,
  });

  const createdVariant = adminCreate.body.variants.find(
    (variant) => variant.sku === createdVariantSku,
  );
  assert(createdVariant, 'created variant must be present in admin create response');
  summary.fixture = {
    productId: FIXTURE_PRODUCT_ID,
    createdVariantId: createdVariant.id,
    trackedVariantIds: [REGULAR_VARIANT_ID, LARGE_VARIANT_ID, createdVariant.id],
  };

  assert.equal(createdVariant.ingredientCount, 0);
  assert.equal(createdVariant.isInStock, false);
  assert.equal(createdVariant.isSellable, false);
  assert.equal(createdVariant.availableBaseQty, 0);
  assert.equal(createdVariant.blockingReason, 'NO_RECIPE');
  assert.equal(adminCreate.body.variantCount, 3);
  assert.equal(adminCreate.body.effectiveStatus, 'NO_VALID_RECIPE');

  await assertNoDisallowedDrift('admin-create-variant');

  const createDuplicateName = await admin.client.request(
    'POST',
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    {
      json: {
        name: createdVariantName,
        sku: `${createdVariantSku}-DUPNAME`,
        price: '120.00',
        isEnabled: true,
      },
    },
  );
  await assertNoSecretsAndTrack(
    createDuplicateName,
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    'admin',
  );
  assert.equal(createDuplicateName.status, 409);
  summary.validationResults.push({
    case: 'create-variant-duplicate-name',
    status: createDuplicateName.status,
    message: sanitizeMessage(createDuplicateName.body?.message),
  });
  await assertNoDisallowedDrift('create-variant-duplicate-name');

  const secondaryAdminDuplicateSku = await secondaryAdmin.client.request(
    'POST',
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    {
      json: {
        name: `${createdVariantName} DupSku`,
        sku: createdVariantSku,
        price: '125.00',
        isEnabled: true,
      },
    },
  );
  await assertNoSecretsAndTrack(
    secondaryAdminDuplicateSku,
    `/admin/products/${FIXTURE_PRODUCT_ID}/variants`,
    'secondary-admin',
  );
  assert.equal(secondaryAdminDuplicateSku.status, 409);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/variants',
    role: 'secondary-admin',
    status: secondaryAdminDuplicateSku.status,
  });
  summary.validationResults.push({
    case: 'create-variant-duplicate-sku',
    status: secondaryAdminDuplicateSku.status,
    message: sanitizeMessage(secondaryAdminDuplicateSku.body?.message),
  });
  await assertNoDisallowedDrift('create-variant-duplicate-sku');

  const unauthUpdate = await unauthenticated.request(
    'PATCH',
    `/admin/variants/${createdVariant.id}`,
    {
      json: {
        name: updatedVariantName,
      },
    },
  );
  await assertNoSecretsAndTrack(
    unauthUpdate,
    `/admin/variants/${createdVariant.id}`,
    'unauthenticated',
  );
  assert.equal(unauthUpdate.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id',
    role: 'unauthenticated',
    status: unauthUpdate.status,
  });
  await assertNoDisallowedDrift('unauth-update-variant');

  const staffUpdate = await staff.client.request(
    'PATCH',
    `/admin/variants/${createdVariant.id}`,
    {
      json: {
        name: updatedVariantName,
      },
    },
  );
  await assertNoSecretsAndTrack(
    staffUpdate,
    `/admin/variants/${createdVariant.id}`,
    'staff',
  );
  assert.equal(staffUpdate.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id',
    role: 'staff',
    status: staffUpdate.status,
  });
  await assertNoDisallowedDrift('staff-update-variant');

  const unknownVariantUpdate = await admin.client.request(
    'PATCH',
    `/admin/variants/${UNKNOWN_ID}`,
    {
      json: {
        name: 'Missing Variant',
      },
    },
  );
  await assertNoSecretsAndTrack(
    unknownVariantUpdate,
    `/admin/variants/${UNKNOWN_ID}`,
    'admin',
  );
  assert.equal(unknownVariantUpdate.status, 404);
  summary.validationResults.push({
    case: 'update-variant-unknown',
    status: unknownVariantUpdate.status,
    message: sanitizeMessage(unknownVariantUpdate.body?.message),
  });
  await assertNoDisallowedDrift('update-variant-unknown');

  const duplicateVariantName = await admin.client.request(
    'PATCH',
    `/admin/variants/${createdVariant.id}`,
    {
      json: {
        name: 'PBT2 Regular',
      },
    },
  );
  await assertNoSecretsAndTrack(
    duplicateVariantName,
    `/admin/variants/${createdVariant.id}`,
    'admin',
  );
  assert.equal(duplicateVariantName.status, 409);
  summary.validationResults.push({
    case: 'update-variant-duplicate-name',
    status: duplicateVariantName.status,
    message: sanitizeMessage(duplicateVariantName.body?.message),
  });
  await assertNoDisallowedDrift('update-variant-duplicate-name');

  const duplicateVariantSku = await admin.client.request(
    'PATCH',
    `/admin/variants/${createdVariant.id}`,
    {
      json: {
        sku: 'PBT2-SKU-20260808171522-REG',
      },
    },
  );
  await assertNoSecretsAndTrack(
    duplicateVariantSku,
    `/admin/variants/${createdVariant.id}`,
    'admin',
  );
  assert.equal(duplicateVariantSku.status, 409);
  summary.validationResults.push({
    case: 'update-variant-duplicate-sku',
    status: duplicateVariantSku.status,
    message: sanitizeMessage(duplicateVariantSku.body?.message),
  });
  await assertNoDisallowedDrift('update-variant-duplicate-sku');

  const adminUpdate = await admin.client.request(
    'PATCH',
    `/admin/variants/${createdVariant.id}`,
    {
      json: {
        name: updatedVariantName,
        sku: updatedVariantSku,
        price: '130.25',
      },
    },
  );
  await assertNoSecretsAndTrack(
    adminUpdate,
    `/admin/variants/${createdVariant.id}`,
    'admin',
  );
  assert.equal(adminUpdate.status, 200);
  assertProductDetailContract(adminUpdate.body);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id',
    role: 'admin',
    status: adminUpdate.status,
  });
  const adminUpdatedVariant = findVariant(adminUpdate.body, createdVariant.id);
  assert.equal(adminUpdatedVariant.name, updatedVariantName);
  assert.equal(adminUpdatedVariant.sku, updatedVariantSku);
  assert.equal(adminUpdatedVariant.price, '130.25');
  summary.mutationResults.push({
    operation: 'admin-update-variant',
    variantId: createdVariant.id,
    name: adminUpdatedVariant.name,
    sku: adminUpdatedVariant.sku,
    price: adminUpdatedVariant.price,
  });
  await assertNoDisallowedDrift('admin-update-variant');

  const secondaryAdminUpdate = await secondaryAdmin.client.request(
    'PATCH',
    `/admin/variants/${createdVariant.id}`,
    {
      json: {
        name: finalVariantName,
        sku: finalVariantSku,
        price: '135.75',
      },
    },
  );
  await assertNoSecretsAndTrack(
    secondaryAdminUpdate,
    `/admin/variants/${createdVariant.id}`,
    'secondary-admin',
  );
  assert.equal(secondaryAdminUpdate.status, 200);
  assertProductDetailContract(secondaryAdminUpdate.body);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id',
    role: 'secondary-admin',
    status: secondaryAdminUpdate.status,
  });
  const secondaryAdminUpdatedVariant = findVariant(secondaryAdminUpdate.body, createdVariant.id);
  assert.equal(secondaryAdminUpdatedVariant.name, finalVariantName);
  assert.equal(secondaryAdminUpdatedVariant.sku, finalVariantSku);
  assert.equal(secondaryAdminUpdatedVariant.price, '135.75');
  summary.mutationResults.push({
    operation: 'secondary-admin-update-variant',
    variantId: createdVariant.id,
    name: secondaryAdminUpdatedVariant.name,
    sku: secondaryAdminUpdatedVariant.sku,
    price: secondaryAdminUpdatedVariant.price,
  });
  await assertNoDisallowedDrift('secondary-admin-update-variant');

  const unauthGetRecipe = await unauthenticated.request(
    'GET',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
  );
  await assertNoSecretsAndTrack(
    unauthGetRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'unauthenticated',
  );
  assert.equal(unauthGetRecipe.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/recipe[GET]',
    role: 'unauthenticated',
    status: unauthGetRecipe.status,
  });
  await assertNoDisallowedDrift('unauth-get-recipe');

  const staffGetRecipe = await staff.client.request(
    'GET',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
  );
  await assertNoSecretsAndTrack(
    staffGetRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'staff',
  );
  assert.equal(staffGetRecipe.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/recipe[GET]',
    role: 'staff',
    status: staffGetRecipe.status,
  });
  await assertNoDisallowedDrift('staff-get-recipe');

  const duplicateRecipe = await admin.client.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: candidateMaterials.primary.id,
            quantity: '10',
          },
          {
            rawMaterialId: candidateMaterials.primary.id,
            quantity: '12',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    duplicateRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'admin',
  );
  assert.equal(duplicateRecipe.status, 400);
  summary.validationResults.push({
    case: 'replace-recipe-duplicate-raw-material',
    status: duplicateRecipe.status,
    message: sanitizeMessage(duplicateRecipe.body?.message),
  });
  await assertNoDisallowedDrift('replace-recipe-duplicate-raw-material');

  const nonexistentRecipe = await admin.client.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: UNKNOWN_ID,
            quantity: '10',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    nonexistentRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'admin',
  );
  assert.equal(nonexistentRecipe.status, 400);
  summary.validationResults.push({
    case: 'replace-recipe-nonexistent-raw-material',
    status: nonexistentRecipe.status,
    message: sanitizeMessage(nonexistentRecipe.body?.message),
  });
  await assertNoDisallowedDrift('replace-recipe-nonexistent-raw-material');

  const inactiveRecipe = await admin.client.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: candidateMaterials.inactive.id,
            quantity: '10',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    inactiveRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'admin',
  );
  assert.equal(inactiveRecipe.status, 400);
  summary.validationResults.push({
    case: 'replace-recipe-inactive-raw-material',
    status: inactiveRecipe.status,
    message: sanitizeMessage(inactiveRecipe.body?.message),
  });
  await assertNoDisallowedDrift('replace-recipe-inactive-raw-material');

  const zeroQuantityRecipe = await admin.client.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: candidateMaterials.primary.id,
            quantity: '0',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    zeroQuantityRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'admin',
  );
  assert.equal(zeroQuantityRecipe.status, 400);
  summary.validationResults.push({
    case: 'replace-recipe-zero-quantity',
    status: zeroQuantityRecipe.status,
    message: sanitizeMessage(zeroQuantityRecipe.body?.message),
  });
  await assertNoDisallowedDrift('replace-recipe-zero-quantity');

  const unauthReplaceRecipe = await unauthenticated.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: candidateMaterials.primary.id,
            quantity: '10',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    unauthReplaceRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'unauthenticated',
  );
  assert.equal(unauthReplaceRecipe.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/recipe[PUT]',
    role: 'unauthenticated',
    status: unauthReplaceRecipe.status,
  });
  await assertNoDisallowedDrift('unauth-replace-recipe');

  const staffReplaceRecipe = await staff.client.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: candidateMaterials.primary.id,
            quantity: '10',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    staffReplaceRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'staff',
  );
  assert.equal(staffReplaceRecipe.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/recipe[PUT]',
    role: 'staff',
    status: staffReplaceRecipe.status,
  });
  await assertNoDisallowedDrift('staff-replace-recipe');

  const adminRecipeOne = await admin.client.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: candidateMaterials.primary.id,
            quantity: '10',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    adminRecipeOne,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'admin',
  );
  assert.equal(adminRecipeOne.status, 200);
  assertRecipeContract(adminRecipeOne.body.recipe);
  assertProductDetailContract(adminRecipeOne.body.product);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/recipe[PUT]',
    role: 'admin',
    status: adminRecipeOne.status,
  });
  assert.equal(adminRecipeOne.body.recipe.items.length, 1);
  assert.equal(adminRecipeOne.body.recipe.items[0].rawMaterialId, candidateMaterials.primary.id);
  const regularVariantAfterRecipeOne = findVariant(
    adminRecipeOne.body.product,
    REGULAR_VARIANT_ID,
  );
  assert.equal(regularVariantAfterRecipeOne.ingredientCount, 1);
  assert.equal(regularVariantAfterRecipeOne.isInStock, true);
  assert.equal(regularVariantAfterRecipeOne.isSellable, true);
  assert.equal(regularVariantAfterRecipeOne.availableBaseQty, 114);
  assert.equal(regularVariantAfterRecipeOne.blockingReason, 'NONE');
  assert.equal(adminRecipeOne.body.product.effectiveStatus, 'PARTIALLY_AVAILABLE');
  summary.mutationResults.push({
    operation: 'admin-replace-regular-recipe-single-material',
    variantId: REGULAR_VARIANT_ID,
    availableBaseQty: regularVariantAfterRecipeOne.availableBaseQty,
    blockingReason: regularVariantAfterRecipeOne.blockingReason,
  });
  await assertNoDisallowedDrift('admin-replace-regular-recipe-single-material');

  const eventCountAfterRecipeOne = (await getFingerprint()).tableStates.variant_availability_events.count;

  const secondaryAdminRecipeTwo = await secondaryAdmin.client.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: candidateMaterials.primary.id,
            quantity: '20',
          },
          {
            rawMaterialId: candidateMaterials.secondary.id,
            quantity: '1',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    secondaryAdminRecipeTwo,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'secondary-admin',
  );
  assert.equal(secondaryAdminRecipeTwo.status, 200);
  assertRecipeContract(secondaryAdminRecipeTwo.body.recipe);
  assertProductDetailContract(secondaryAdminRecipeTwo.body.product);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/recipe[PUT]',
    role: 'secondary-admin',
    status: secondaryAdminRecipeTwo.status,
  });
  assert.equal(secondaryAdminRecipeTwo.body.recipe.items.length, 2);
  const regularVariantAfterRecipeTwo = findVariant(
    secondaryAdminRecipeTwo.body.product,
    REGULAR_VARIANT_ID,
  );
  assert.equal(regularVariantAfterRecipeTwo.ingredientCount, 2);
  assert.equal(regularVariantAfterRecipeTwo.isInStock, true);
  assert.equal(regularVariantAfterRecipeTwo.isSellable, true);
  assert.equal(regularVariantAfterRecipeTwo.availableBaseQty, 18);
  assert.equal(regularVariantAfterRecipeTwo.blockingReason, 'NONE');
  summary.mutationResults.push({
    operation: 'secondary-admin-replace-regular-recipe-two-materials',
    variantId: REGULAR_VARIANT_ID,
    availableBaseQty: regularVariantAfterRecipeTwo.availableBaseQty,
    blockingReason: regularVariantAfterRecipeTwo.blockingReason,
  });
  await assertNoDisallowedDrift('secondary-admin-replace-regular-recipe-two-materials');

  const eventCountAfterRecipeTwo = (await getFingerprint()).tableStates.variant_availability_events.count;
  assert.equal(eventCountAfterRecipeTwo, eventCountAfterRecipeOne);

  const unauthManual = await unauthenticated.request(
    'PATCH',
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    {
      json: { isEnabled: false },
    },
  );
  await assertNoSecretsAndTrack(
    unauthManual,
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    'unauthenticated',
  );
  assert.equal(unauthManual.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/manual-availability',
    role: 'unauthenticated',
    status: unauthManual.status,
  });
  await assertNoDisallowedDrift('unauth-manual-variant');

  const staffManual = await staff.client.request(
    'PATCH',
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    {
      json: { isEnabled: false },
    },
  );
  await assertNoSecretsAndTrack(
    staffManual,
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    'staff',
  );
  assert.equal(staffManual.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/manual-availability',
    role: 'staff',
    status: staffManual.status,
  });
  await assertNoDisallowedDrift('staff-manual-variant');

  const invalidManual = await admin.client.request(
    'PATCH',
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    {
      json: {},
    },
  );
  await assertNoSecretsAndTrack(
    invalidManual,
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    'admin',
  );
  assert.equal(invalidManual.status, 400);
  summary.validationResults.push({
    case: 'variant-manual-availability-missing-boolean',
    status: invalidManual.status,
    message: sanitizeMessage(invalidManual.body?.message),
  });
  await assertNoDisallowedDrift('variant-manual-availability-missing-boolean');

  const adminDisable = await admin.client.request(
    'PATCH',
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    {
      json: { isEnabled: false },
    },
  );
  await assertNoSecretsAndTrack(
    adminDisable,
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    'admin',
  );
  assert.equal(adminDisable.status, 200);
  assertProductDetailContract(adminDisable.body);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/manual-availability',
    role: 'admin',
    status: adminDisable.status,
  });
  const regularVariantDisabled = findVariant(adminDisable.body, REGULAR_VARIANT_ID);
  assert.equal(regularVariantDisabled.manualAvailability, false);
  assert.equal(regularVariantDisabled.isInStock, true);
  assert.equal(regularVariantDisabled.isSellable, false);
  assert.equal(regularVariantDisabled.availableBaseQty, 18);
  assert.equal(regularVariantDisabled.blockingReason, 'DISABLED_VARIANT');
  summary.mutationResults.push({
    operation: 'admin-disable-regular-variant',
    variantId: REGULAR_VARIANT_ID,
    blockingReason: regularVariantDisabled.blockingReason,
    availableBaseQty: regularVariantDisabled.availableBaseQty,
  });
  await assertNoDisallowedDrift('admin-disable-regular-variant');

  const secondaryAdminEnable = await secondaryAdmin.client.request(
    'PATCH',
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    {
      json: { isEnabled: true },
    },
  );
  await assertNoSecretsAndTrack(
    secondaryAdminEnable,
    `/admin/variants/${REGULAR_VARIANT_ID}/manual-availability`,
    'secondary-admin',
  );
  assert.equal(secondaryAdminEnable.status, 200);
  assertProductDetailContract(secondaryAdminEnable.body);
  summary.roleAccessResults.push({
    route: '/admin/variants/:id/manual-availability',
    role: 'secondary-admin',
    status: secondaryAdminEnable.status,
  });
  const regularVariantEnabled = findVariant(secondaryAdminEnable.body, REGULAR_VARIANT_ID);
  assert.equal(regularVariantEnabled.manualAvailability, true);
  assert.equal(regularVariantEnabled.isInStock, true);
  assert.equal(regularVariantEnabled.isSellable, true);
  assert.equal(regularVariantEnabled.availableBaseQty, 18);
  assert.equal(regularVariantEnabled.blockingReason, 'NONE');
  summary.mutationResults.push({
    operation: 'secondary-admin-enable-regular-variant',
    variantId: REGULAR_VARIANT_ID,
    blockingReason: regularVariantEnabled.blockingReason,
    availableBaseQty: regularVariantEnabled.availableBaseQty,
  });
  await assertNoDisallowedDrift('secondary-admin-enable-regular-variant');

  const adminEmptyRecipe = await admin.client.request(
    'PUT',
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    {
      json: {
        items: [],
      },
    },
  );
  await assertNoSecretsAndTrack(
    adminEmptyRecipe,
    `/admin/variants/${REGULAR_VARIANT_ID}/recipe`,
    'admin',
  );
  assert.equal(adminEmptyRecipe.status, 200);
  assertRecipeContract(adminEmptyRecipe.body.recipe);
  assertProductDetailContract(adminEmptyRecipe.body.product);
  assert.equal(adminEmptyRecipe.body.recipe.items.length, 0);
  const regularVariantEmptyRecipe = findVariant(
    adminEmptyRecipe.body.product,
    REGULAR_VARIANT_ID,
  );
  assert.equal(regularVariantEmptyRecipe.ingredientCount, 0);
  assert.equal(regularVariantEmptyRecipe.isInStock, false);
  assert.equal(regularVariantEmptyRecipe.isSellable, false);
  assert.equal(regularVariantEmptyRecipe.availableBaseQty, 0);
  assert.equal(regularVariantEmptyRecipe.blockingReason, 'NO_RECIPE');
  summary.mutationResults.push({
    operation: 'admin-empty-regular-recipe',
    variantId: REGULAR_VARIANT_ID,
    blockingReason: regularVariantEmptyRecipe.blockingReason,
  });
  await assertNoDisallowedDrift('admin-empty-regular-recipe');

  const adminRecipeNewVariant = await admin.client.request(
    'PUT',
    `/admin/variants/${createdVariant.id}/recipe`,
    {
      json: {
        items: [
          {
            rawMaterialId: candidateMaterials.primary.id,
            quantity: '5',
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(
    adminRecipeNewVariant,
    `/admin/variants/${createdVariant.id}/recipe`,
    'admin',
  );
  assert.equal(adminRecipeNewVariant.status, 200);
  assertRecipeContract(adminRecipeNewVariant.body.recipe);
  assertProductDetailContract(adminRecipeNewVariant.body.product);
  const finalCreatedVariant = findVariant(
    adminRecipeNewVariant.body.product,
    createdVariant.id,
  );
  assert.equal(finalCreatedVariant.manualAvailability, true);
  assert.equal(finalCreatedVariant.ingredientCount, 1);
  assert.equal(finalCreatedVariant.isInStock, true);
  assert.equal(finalCreatedVariant.isSellable, true);
  assert.equal(finalCreatedVariant.availableBaseQty, 228);
  assert.equal(finalCreatedVariant.blockingReason, 'NONE');
  assert.equal(adminRecipeNewVariant.body.product.effectiveStatus, 'PARTIALLY_AVAILABLE');
  summary.mutationResults.push({
    operation: 'admin-add-recipe-to-created-variant',
    variantId: createdVariant.id,
    blockingReason: finalCreatedVariant.blockingReason,
    availableBaseQty: finalCreatedVariant.availableBaseQty,
  });
  await assertNoDisallowedDrift('admin-add-recipe-to-created-variant');

  const trackedMaterialAfter = await getTrackedMaterialSnapshots([
    candidateMaterials.primary.id,
    candidateMaterials.secondary.id,
    candidateMaterials.inactive.id,
  ]);
  assert.equal(
    JSON.stringify(trackedMaterialAfter),
    JSON.stringify(trackedMaterialsBefore),
    'tracked raw material summaries must remain unchanged',
  );

  const finalFingerprint = await getFingerprint();
  assert.equal(
    finalFingerprint.tableStates.product_variants.count,
    baselineFingerprint.tableStates.product_variants.count + 1,
  );
  assert.equal(
    finalFingerprint.tableStates.variant_availability_summaries.count,
    baselineFingerprint.tableStates.variant_availability_summaries.count + 1,
  );
  assert.equal(
    finalFingerprint.tableStates.variant_recipe_items.count,
    baselineFingerprint.tableStates.variant_recipe_items.count + 1,
  );
  assert.equal(
    finalFingerprint.tableStates.variant_availability_events.count,
    baselineFingerprint.tableStates.variant_availability_events.count + 6,
  );
  assert.equal(
    finalFingerprint.tableStates.stockout_events.count,
    baselineFingerprint.tableStates.stockout_events.count,
  );

  const changedVariants = await getChangedVariantsSince(baselineLatestDates.variants);
  const changedVariantSummaries = await getChangedVariantSummariesSince(
    baselineLatestDates.variantSummaries,
  );
  const fixtureVariantIds = [
    REGULAR_VARIANT_ID,
    LARGE_VARIANT_ID,
    createdVariant.id,
  ];
  const fixtureVariantIdSet = new Set(fixtureVariantIds);
  const fixtureVariantEvents = await getFixtureVariantEvents(fixtureVariantIds);
  const fixtureRecipeRows = await getFixtureRecipeRows(fixtureVariantIds);

  assert.equal(
    changedVariants.every(
      (variant) =>
        variant.productId === FIXTURE_PRODUCT_ID &&
        fixtureVariantIdSet.has(variant.id),
    ),
    true,
  );
  assert.equal(
    changedVariantSummaries.every((summaryRow) =>
      fixtureVariantIdSet.has(summaryRow.productVariantId),
    ),
    true,
  );

  const eventCountsByVariant = fixtureVariantEvents.reduce((acc, event) => {
    acc[event.productVariantId] = (acc[event.productVariantId] ?? 0) + 1;
    return acc;
  }, {});

  assert.equal(eventCountsByVariant[REGULAR_VARIANT_ID], 5);
  assert.equal(eventCountsByVariant[LARGE_VARIANT_ID], 1);
  assert.equal(eventCountsByVariant[createdVariant.id], 2);

  const finalFixture = await getRetainedProductSnapshot();
  const finalRegular = finalFixture.variants.find((variant) => variant.id === REGULAR_VARIANT_ID);
  const finalLarge = finalFixture.variants.find((variant) => variant.id === LARGE_VARIANT_ID);
  const finalNew = finalFixture.variants.find((variant) => variant.id === createdVariant.id);

  assert(finalRegular && finalLarge && finalNew, 'final fixture variants must all exist');
  assert.equal(finalRegular.recipeItems.length, 0);
  assert.equal(finalRegular.orderItems.length, 0);
  assert.equal(finalRegular.transactionLines.length, 0);
  assert.equal(finalRegular.availabilitySummary.blockingReason, 'NO_RECIPE');

  assert.equal(finalLarge.recipeItems.length, 0);
  assert.equal(finalLarge.orderItems.length, 0);
  assert.equal(finalLarge.transactionLines.length, 0);
  assert.equal(finalLarge.availabilitySummary.blockingReason, 'NO_RECIPE');

  assert.equal(finalNew.name, finalVariantName);
  assert.equal(finalNew.sku, finalVariantSku);
  assert.equal(finalNew.recipeItems.length, 1);
  assert.equal(finalNew.orderItems.length, 0);
  assert.equal(finalNew.transactionLines.length, 0);
  assert.equal(finalNew.availabilitySummary.isInStock, true);
  assert.equal(finalNew.availabilitySummary.isSellable, true);
  assert.equal(finalNew.availabilitySummary.availableBaseQty, 228);
  assert.equal(finalNew.availabilitySummary.blockingReason, 'NONE');

  await logoutRole('staff', staff.client, staff.sessionId);
  await logoutRole('admin', admin.client, admin.sessionId);
  await logoutRole('secondaryAdmin', secondaryAdmin.client, secondaryAdmin.sessionId);

  summary.finalFingerprint = finalFingerprint;
  summary.finalFixture = {
    productId: finalFixture.id,
    productName: finalFixture.name,
    variantCount: finalFixture.variants.length,
    recipeRowCount: finalFixture.variants.reduce(
      (sum, variant) => sum + variant.recipeItems.length,
      0,
    ),
    variants: finalFixture.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      isEnabled: variant.isEnabled,
      recipeRowCount: variant.recipeItems.length,
      orderItemCount: variant.orderItems.length,
      transactionLineCount: variant.transactionLines.length,
      availabilitySummary: variant.availabilitySummary,
    })),
  };
  summary.trackedMaterialsAfter = trackedMaterialAfter;
  summary.changedRows = {
    variants: changedVariants,
    variantSummaries: changedVariantSummaries,
    fixtureVariantEvents,
    fixtureRecipeRows,
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  try {
    if (process.argv[2] === 'print-fingerprint') {
      console.log(JSON.stringify(await getFingerprint(), null, 2));
      return;
    }

    await runPhase3();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
