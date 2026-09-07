const assert = require('node:assert/strict');
const { loadEnvFile } = require('node:process');
const { PrismaClient } = require('@prisma/client');

loadEnvFile();

const prisma = new PrismaClient();
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

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
  delete clone.tableStates.auth_sessions;
  delete clone.tableStates.users;
  delete clone.aggregates.existingSessionCount;
  return clone;
}

function normalizeFingerprintExcludingAllowedMutationTables(fingerprint) {
  const clone = normalizeNonSessionFingerprint(fingerprint);

  delete clone.tableStates.products;
  delete clone.tableStates.product_variants;
  delete clone.tableStates.variant_availability_summaries;
  delete clone.tableStates.variant_availability_events;

  delete clone.aggregates.productCount;
  delete clone.aggregates.variantCount;
  delete clone.aggregates.archivedProductCount;
  delete clone.aggregates.enabledProductCount;
  delete clone.aggregates.disabledProductCount;
  delete clone.aggregates.enabledVariantCount;
  delete clone.aggregates.disabledVariantCount;
  delete clone.aggregates.availabilityEventCount;
  delete clone.aggregates.variantSummaryCount;

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

  assert.equal('sessionToken' in body, false, 'response must not expose sessionToken');
  assert.equal('token' in body, false, 'response must not expose token');
  assert.equal(JSON.stringify(body).includes('SELECT '), false, 'response must not expose SQL text');
}

function assertProductDetailContract(body) {
  assert(body && typeof body === 'object', 'product detail payload must be an object');
  assert.equal(typeof body.id, 'string');
  assert.equal(typeof body.name, 'string');
  assert(body.category && typeof body.category.id === 'string' && typeof body.category.name === 'string');
  assert.equal(typeof body.manualAvailability, 'boolean');
  assert(body.archive && typeof body.archive === 'object');
  assert.equal(Array.isArray(body.variants), true, 'variants must be an array');
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
    assert(variant.recipeSummary && typeof variant.recipeSummary.itemCount === 'number');
    assert.equal(Array.isArray(variant.recipeSummary.items), true);
  }
}

function parseLatestTimestamp(value, label) {
  assert(value, `${label} latest timestamp is required`);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(value.replace(' ', 'T') + 'Z');
  }
  return new Date(value);
}

async function getChangedProductsSince(baselineLatest) {
  return prisma.product.findMany({
    where: {
      OR: [
        { createdAt: { gt: baselineLatest } },
        { updatedAt: { gt: baselineLatest } },
        { archivedAt: { gt: baselineLatest } },
      ],
    },
    select: {
      id: true,
      name: true,
      categoryId: true,
      isEnabled: true,
      archivedAt: true,
      updatedAt: true,
    },
    orderBy: { id: 'asc' },
  });
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

async function getChangedVariantEventsSince(baselineLatest) {
  return prisma.variantAvailabilityEvent.findMany({
    where: {
      OR: [{ createdAt: { gt: baselineLatest } }, { occurredAt: { gt: baselineLatest } }],
    },
    select: {
      id: true,
      productVariantId: true,
      previousIsSellable: true,
      newIsSellable: true,
      blockingReason: true,
      availableBaseQty: true,
      occurredAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

async function getFixtureVariantEvents(variantIds) {
  return prisma.variantAvailabilityEvent.findMany({
    where: {
      productVariantId: {
        in: variantIds,
      },
    },
    select: {
      id: true,
      productVariantId: true,
      previousIsSellable: true,
      newIsSellable: true,
      blockingReason: true,
      occurredAt: true,
      createdAt: true,
    },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  });
}

async function getFixtureSnapshot(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: true,
      variants: {
        include: {
          availabilitySummary: true,
          recipeItems: true,
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  assert(product, 'fixture product must exist');
  return product;
}

async function countProductsWithName(name) {
  return prisma.product.count({ where: { name } });
}

async function countVariantsWithSkuPrefix(prefix) {
  return prisma.productVariant.count({
    where: {
      sku: {
        startsWith: prefix,
      },
    },
  });
}

async function selectCategories() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });

  assert(categories.length > 0, 'at least one category is required');

  return {
    primary: categories[0],
    alternate: categories[1] ?? categories[0],
  };
}

async function runMutationTests() {
  const baseUrl = process.env.PHASE2_BASE_URL ?? 'http://127.0.0.1:4100';
  const roleInputs = {
    staff: {
      email: process.env.PHASE2_STAFF_EMAIL ?? 'staff@stockscout.com',
      password: process.env.PHASE2_STAFF_PASSWORD ?? 'staff123',
      userId: '77b76a40-8344-4469-8000-a7aa7066da25',
    },
    admin: {
      email: process.env.PHASE2_ADMIN_EMAIL ?? 'admin@stockscout.com',
      password: process.env.PHASE2_ADMIN_PASSWORD ?? 'admin123',
      userId: '755481e6-a252-49cb-a73e-34657841edb3',
    },
    secondaryAdmin: {
      email: process.env.PHASE2_SECONDARY_ADMIN_EMAIL ?? 'sysadmin@stockscout.com',
      password: process.env.PHASE2_SECONDARY_ADMIN_PASSWORD ?? 'sysadmin123',
      userId: 'f8868ca6-644d-407c-917e-db160746a3da',
    },
  };

  const routeMatrix = [
    {
      operation: 'createProduct',
      method: 'POST',
      route: '/admin/products',
      requiredRole: 'ADMINISTRATOR',
      dto: 'CreateProductDto',
    },
    {
      operation: 'updateProduct',
      method: 'PATCH',
      route: '/admin/products/:id',
      requiredRole: 'ADMINISTRATOR',
      dto: 'UpdateProductDto',
    },
    {
      operation: 'setProductManualAvailability',
      method: 'PATCH',
      route: '/admin/products/:id/manual-availability',
      requiredRole: 'ADMINISTRATOR',
      dto: 'SetManualAvailabilityDto',
    },
    {
      operation: 'archiveProduct',
      method: 'POST',
      route: '/admin/products/:id/archive',
      requiredRole: 'ADMINISTRATOR',
      dto: 'ArchiveProductDto',
    },
    {
      operation: 'restoreProduct',
      method: 'POST',
      route: '/admin/products/:id/restore',
      requiredRole: 'ADMINISTRATOR',
      dto: 'No body',
    },
  ];

  const categories = await selectCategories();
  const baselineFingerprint = await getFingerprint();
  const baselineStrict = normalizeNonSessionFingerprint(baselineFingerprint);
  const baselineDisallowed = normalizeFingerprintExcludingAllowedMutationTables(
    baselineFingerprint,
  );
  const trackedUserIds = Object.values(roleInputs).map((input) => input.userId);
  const initialUsers = await getUsersState(trackedUserIds);

  const summary = {
    routeMatrix,
    categories,
    baselineFingerprint,
    initialUsers,
    roleAccessResults: [],
    validationResults: [],
    mutationResults: [],
    driftChecks: [],
    httpReview: [],
    authSessions: [],
    fixture: null,
  };

  const baselineLatestDates = {
    products: parseLatestTimestamp(
      baselineFingerprint.tableStates.products.latest,
      'products',
    ),
    variants: parseLatestTimestamp(
      baselineFingerprint.tableStates.product_variants.latest,
      'product_variants',
    ),
    variantSummaries: parseLatestTimestamp(
      baselineFingerprint.tableStates.variant_availability_summaries.latest,
      'variant_availability_summaries',
    ),
    variantEvents: parseLatestTimestamp(
      baselineFingerprint.tableStates.variant_availability_events.latest,
      'variant_availability_events',
    ),
  };

  async function assertFingerprintMatch(stage, normalizer, expected) {
    const current = normalizer(await getFingerprint());
    const match = JSON.stringify(current) === JSON.stringify(expected);
    summary.driftChecks.push({ stage, match });
    assert.equal(match, true, `unexpected database drift detected at ${stage}`);
  }

  async function assertNoPreMutationDrift(stage) {
    await assertFingerprintMatch(stage, normalizeNonSessionFingerprint, baselineStrict);
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
      errorMessage: sanitizeMessage(response.body?.message),
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

  const now = new Date();
  const timestamp = [
    now.getUTCFullYear(),
    `${now.getUTCMonth() + 1}`.padStart(2, '0'),
    `${now.getUTCDate()}`.padStart(2, '0'),
    `${now.getUTCHours()}`.padStart(2, '0'),
    `${now.getUTCMinutes()}`.padStart(2, '0'),
    `${now.getUTCSeconds()}`.padStart(2, '0'),
  ].join('');

  const baseProductName = `PBT2_Product_${timestamp}`;
  const adminUpdatedName = `${baseProductName}_Admin`;
  const secondaryAdminUpdatedName = `${baseProductName}_Sys`;
  const skuPrefix = `PBT2-SKU-${timestamp}`;
  const validCreatePayload = {
    name: baseProductName,
    categoryId: categories.primary.id,
    isEnabled: true,
    initialVariants: [
      {
        name: 'PBT2 Regular',
        sku: `${skuPrefix}-REG`,
        price: '145.50',
        isEnabled: true,
      },
      {
        name: 'PBT2 Large',
        sku: `${skuPrefix}-LRG`,
        price: '165.00',
        isEnabled: true,
      },
    ],
  };

  assert.equal(await countProductsWithName(baseProductName), 0);
  assert.equal(await countVariantsWithSkuPrefix(skuPrefix), 0);

  const unauthenticated = new SessionClient(baseUrl);
  const unauthCreate = await unauthenticated.request('POST', '/admin/products', {
    json: validCreatePayload,
  });
  await assertNoSecretsAndTrack(unauthCreate, '/admin/products', 'unauthenticated');
  assert.equal(unauthCreate.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/products',
    role: 'unauthenticated',
    status: unauthCreate.status,
  });
  await assertNoPreMutationDrift('unauth-create');

  const staff = await loginAs('staff');
  const staffCreate = await staff.client.request('POST', '/admin/products', {
    json: validCreatePayload,
  });
  await assertNoSecretsAndTrack(staffCreate, '/admin/products', 'staff');
  assert.equal(staffCreate.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/products',
    role: 'staff',
    status: staffCreate.status,
  });
  await assertNoPreMutationDrift('staff-create');
  await logoutRole('staff', staff.client, staff.sessionId);

  const admin = await loginAs('admin');
  const secondaryAdmin = await loginAs('secondaryAdmin');

  const invalidNoVariantPayload = {
    name: `${baseProductName}_NoVariants`,
    categoryId: categories.primary.id,
    isEnabled: true,
    initialVariants: [],
  };
  const invalidNoVariant = await admin.client.request('POST', '/admin/products', {
    json: invalidNoVariantPayload,
  });
  await assertNoSecretsAndTrack(invalidNoVariant, '/admin/products', 'admin');
  assert.equal(invalidNoVariant.status, 400);
  assert.equal(await countProductsWithName(invalidNoVariantPayload.name), 0);
  summary.validationResults.push({
    case: 'create-no-variants',
    status: invalidNoVariant.status,
    message: sanitizeMessage(invalidNoVariant.body?.message),
  });
  await assertNoPreMutationDrift('admin-invalid-create-no-variants');

  const invalidDuplicateVariantPayload = {
    name: `${baseProductName}_DuplicateVariants`,
    categoryId: categories.primary.id,
    isEnabled: true,
    initialVariants: [
      {
        name: 'Repeated',
        sku: `${skuPrefix}-DUP`,
        price: '140.00',
        isEnabled: true,
      },
      {
        name: 'Repeated',
        sku: `${skuPrefix}-DUP`,
        price: '155.00',
        isEnabled: true,
      },
    ],
  };
  const invalidDuplicateVariant = await admin.client.request(
    'POST',
    '/admin/products',
    {
      json: invalidDuplicateVariantPayload,
    },
  );
  await assertNoSecretsAndTrack(invalidDuplicateVariant, '/admin/products', 'admin');
  assert.equal(invalidDuplicateVariant.status, 400);
  assert.equal(await countProductsWithName(invalidDuplicateVariantPayload.name), 0);
  summary.validationResults.push({
    case: 'create-duplicate-variants',
    status: invalidDuplicateVariant.status,
    message: sanitizeMessage(invalidDuplicateVariant.body?.message),
  });
  await assertNoPreMutationDrift('admin-invalid-create-duplicate-variants');

  const createResponse = await admin.client.request('POST', '/admin/products', {
    json: validCreatePayload,
  });
  await assertNoSecretsAndTrack(createResponse, '/admin/products', 'admin');
  assert.equal(createResponse.status, 201);
  assertProductDetailContract(createResponse.body);

  const fixture = createResponse.body;
  summary.roleAccessResults.push({
    route: '/admin/products',
    role: 'admin',
    status: createResponse.status,
  });
  summary.fixture = {
    productId: fixture.id,
    productName: fixture.name,
    variantIds: fixture.variants.map((variant) => variant.id),
    variantSkus: fixture.variants.map((variant) => variant.sku),
  };

  const postCreateFingerprint = await getFingerprint();
  assert.equal(
    postCreateFingerprint.tableStates.products.count,
    baselineFingerprint.tableStates.products.count + 1,
  );
  assert.equal(
    postCreateFingerprint.tableStates.product_variants.count,
    baselineFingerprint.tableStates.product_variants.count +
      validCreatePayload.initialVariants.length,
  );
  assert.equal(
    postCreateFingerprint.tableStates.variant_availability_summaries.count,
    baselineFingerprint.tableStates.variant_availability_summaries.count +
      validCreatePayload.initialVariants.length,
  );
  await assertNoDisallowedDrift('admin-create-product');

  const fixtureSnapshot = await getFixtureSnapshot(fixture.id);
  assert.equal(fixtureSnapshot.name, baseProductName);
  assert.equal(fixtureSnapshot.categoryId, categories.primary.id);
  assert.equal(fixtureSnapshot.variants.length, validCreatePayload.initialVariants.length);
  assert.equal(fixtureSnapshot.variants.every((variant) => variant.recipeItems.length === 0), true);
  assert.equal(
    fixtureSnapshot.variants.every(
      (variant) =>
        variant.availabilitySummary &&
        variant.availabilitySummary.blockingReason === 'NO_RECIPE' &&
        variant.availabilitySummary.isInStock === false &&
        variant.availabilitySummary.isSellable === false &&
        variant.availabilitySummary.availableBaseQty === 0,
    ),
    true,
  );
  assert.equal(fixture.deleteEligibility.eligible, false);
  assert.equal(
    fixture.deleteEligibility.blockingReasons.some(
      (reason) => reason.code === 'HAS_AVAILABILITY_HISTORY',
    ),
    true,
  );

  const secondaryAdminDuplicateCreate = await secondaryAdmin.client.request(
    'POST',
    '/admin/products',
    {
      json: {
        name: baseProductName,
        categoryId: categories.primary.id,
        isEnabled: true,
        initialVariants: [
          {
            name: 'PBT2 Conflict',
            sku: `${skuPrefix}-SYS-CONFLICT`,
            price: '150.00',
            isEnabled: true,
          },
        ],
      },
    },
  );
  await assertNoSecretsAndTrack(secondaryAdminDuplicateCreate, '/admin/products', 'secondary-admin');
  assert.equal(secondaryAdminDuplicateCreate.status, 409);
  summary.roleAccessResults.push({
    route: '/admin/products',
    role: 'secondary-admin',
    status: secondaryAdminDuplicateCreate.status,
  });
  await assertFingerprintMatch(
    'secondary-admin-create-conflict',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postCreateFingerprint),
  );

  const unauthUpdate = await unauthenticated.request('PATCH', `/admin/products/${fixture.id}`, {
    json: { name: `${baseProductName}_NoAuth` },
  });
  await assertNoSecretsAndTrack(
    unauthUpdate,
    `/admin/products/${fixture.id}`,
    'unauthenticated',
  );
  assert.equal(unauthUpdate.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/products/:id',
    role: 'unauthenticated',
    status: unauthUpdate.status,
  });
  await assertFingerprintMatch(
    'unauth-update',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postCreateFingerprint),
  );

  const staffAgain = await loginAs('staff');
  const staffUpdate = await staffAgain.client.request(
    'PATCH',
    `/admin/products/${fixture.id}`,
    {
      json: { name: `${baseProductName}_Staff` },
    },
  );
  await assertNoSecretsAndTrack(staffUpdate, `/admin/products/${fixture.id}`, 'staff');
  assert.equal(staffUpdate.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/products/:id',
    role: 'staff',
    status: staffUpdate.status,
  });
  await assertFingerprintMatch(
    'staff-update',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postCreateFingerprint),
  );
  const adminUpdateResponse = await admin.client.request(
    'PATCH',
    `/admin/products/${fixture.id}`,
    {
      json: {
        name: adminUpdatedName,
        categoryId: categories.alternate.id,
      },
    },
  );
  await assertNoSecretsAndTrack(adminUpdateResponse, `/admin/products/${fixture.id}`, 'admin');
  assert.equal(adminUpdateResponse.status, 200);
  assertProductDetailContract(adminUpdateResponse.body);
  assert.equal(adminUpdateResponse.body.name, adminUpdatedName);
  assert.equal(adminUpdateResponse.body.category.id, categories.alternate.id);
  summary.roleAccessResults.push({
    route: '/admin/products/:id',
    role: 'admin',
    status: adminUpdateResponse.status,
  });
  summary.mutationResults.push({
    operation: 'admin-update-product',
    productId: fixture.id,
    name: adminUpdateResponse.body.name,
    categoryId: adminUpdateResponse.body.category.id,
  });
  const postAdminUpdateFingerprint = await getFingerprint();
  await assertNoDisallowedDrift('admin-update-product');

  const secondaryAdminUpdateResponse = await secondaryAdmin.client.request(
    'PATCH',
    `/admin/products/${fixture.id}`,
    {
      json: {
        name: secondaryAdminUpdatedName,
        categoryId: categories.primary.id,
      },
    },
  );
  await assertNoSecretsAndTrack(
    secondaryAdminUpdateResponse,
    `/admin/products/${fixture.id}`,
    'secondary-admin',
  );
  assert.equal(secondaryAdminUpdateResponse.status, 200);
  assertProductDetailContract(secondaryAdminUpdateResponse.body);
  assert.equal(secondaryAdminUpdateResponse.body.name, secondaryAdminUpdatedName);
  assert.equal(secondaryAdminUpdateResponse.body.category.id, categories.primary.id);
  summary.roleAccessResults.push({
    route: '/admin/products/:id',
    role: 'secondary-admin',
    status: secondaryAdminUpdateResponse.status,
  });
  summary.mutationResults.push({
    operation: 'secondary-admin-update-product',
    productId: fixture.id,
    name: secondaryAdminUpdateResponse.body.name,
    categoryId: secondaryAdminUpdateResponse.body.category.id,
  });
  const postSysadminUpdateFingerprint = await getFingerprint();
  await assertNoDisallowedDrift('secondary-admin-update-product');

  const unknownUpdate = await admin.client.request('PATCH', `/admin/products/${UNKNOWN_ID}`, {
    json: { name: 'Missing Product' },
  });
  await assertNoSecretsAndTrack(unknownUpdate, `/admin/products/${UNKNOWN_ID}`, 'admin');
  assert.equal(unknownUpdate.status, 404);
  summary.validationResults.push({
    case: 'update-unknown-product',
    status: unknownUpdate.status,
    message: sanitizeMessage(unknownUpdate.body?.message),
  });
  await assertFingerprintMatch(
    'admin-update-unknown',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postSysadminUpdateFingerprint),
  );

  const unauthManual = await unauthenticated.request(
    'PATCH',
    `/admin/products/${fixture.id}/manual-availability`,
    {
      json: { isEnabled: false },
    },
  );
  await assertNoSecretsAndTrack(
    unauthManual,
    `/admin/products/${fixture.id}/manual-availability`,
    'unauthenticated',
  );
  assert.equal(unauthManual.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/manual-availability',
    role: 'unauthenticated',
    status: unauthManual.status,
  });
  await assertFingerprintMatch(
    'unauth-manual',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postSysadminUpdateFingerprint),
  );

  const staffManual = await staffAgain.client.request(
    'PATCH',
    `/admin/products/${fixture.id}/manual-availability`,
    {
      json: { isEnabled: false },
    },
  );
  await assertNoSecretsAndTrack(
    staffManual,
    `/admin/products/${fixture.id}/manual-availability`,
    'staff',
  );
  assert.equal(staffManual.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/manual-availability',
    role: 'staff',
    status: staffManual.status,
  });
  await assertFingerprintMatch(
    'staff-manual',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postSysadminUpdateFingerprint),
  );

  const invalidManual = await admin.client.request(
    'PATCH',
    `/admin/products/${fixture.id}/manual-availability`,
    {
      json: {},
    },
  );
  await assertNoSecretsAndTrack(
    invalidManual,
    `/admin/products/${fixture.id}/manual-availability`,
    'admin',
  );
  assert.equal(invalidManual.status, 400);
  summary.validationResults.push({
    case: 'manual-availability-missing-boolean',
    status: invalidManual.status,
    message: sanitizeMessage(invalidManual.body?.message),
  });
  await assertFingerprintMatch(
    'invalid-manual',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postSysadminUpdateFingerprint),
  );

  const adminDisable = await admin.client.request(
    'PATCH',
    `/admin/products/${fixture.id}/manual-availability`,
    {
      json: { isEnabled: false },
    },
  );
  await assertNoSecretsAndTrack(
    adminDisable,
    `/admin/products/${fixture.id}/manual-availability`,
    'admin',
  );
  assert.equal(adminDisable.status, 200);
  assertProductDetailContract(adminDisable.body);
  assert.equal(adminDisable.body.manualAvailability, false);
  assert.equal(adminDisable.body.effectiveStatus, 'MANUALLY_DISABLED');
  summary.roleAccessResults.push({
    route: '/admin/products/:id/manual-availability',
    role: 'admin',
    status: adminDisable.status,
  });
  summary.mutationResults.push({
    operation: 'admin-disable-manual-availability',
    productId: fixture.id,
    effectiveStatus: adminDisable.body.effectiveStatus,
  });
  const postDisableFingerprint = await getFingerprint();
  await assertNoDisallowedDrift('admin-disable-manual-availability');

  const secondaryAdminEnable = await secondaryAdmin.client.request(
    'PATCH',
    `/admin/products/${fixture.id}/manual-availability`,
    {
      json: { isEnabled: true },
    },
  );
  await assertNoSecretsAndTrack(
    secondaryAdminEnable,
    `/admin/products/${fixture.id}/manual-availability`,
    'secondary-admin',
  );
  assert.equal(secondaryAdminEnable.status, 200);
  assertProductDetailContract(secondaryAdminEnable.body);
  assert.equal(secondaryAdminEnable.body.manualAvailability, true);
  assert.equal(secondaryAdminEnable.body.effectiveStatus, 'NO_VALID_RECIPE');
  summary.roleAccessResults.push({
    route: '/admin/products/:id/manual-availability',
    role: 'secondary-admin',
    status: secondaryAdminEnable.status,
  });
  summary.mutationResults.push({
    operation: 'secondary-admin-enable-manual-availability',
    productId: fixture.id,
    effectiveStatus: secondaryAdminEnable.body.effectiveStatus,
  });
  const postEnableFingerprint = await getFingerprint();
  await assertNoDisallowedDrift('secondary-admin-enable-manual-availability');

  const unauthArchive = await unauthenticated.request(
    'POST',
    `/admin/products/${fixture.id}/archive`,
    {
      json: { reason: 'unauthorized' },
    },
  );
  await assertNoSecretsAndTrack(
    unauthArchive,
    `/admin/products/${fixture.id}/archive`,
    'unauthenticated',
  );
  assert.equal(unauthArchive.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/archive',
    role: 'unauthenticated',
    status: unauthArchive.status,
  });
  await assertFingerprintMatch(
    'unauth-archive',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postEnableFingerprint),
  );

  const staffArchive = await staffAgain.client.request(
    'POST',
    `/admin/products/${fixture.id}/archive`,
    {
      json: { reason: 'staff' },
    },
  );
  await assertNoSecretsAndTrack(staffArchive, `/admin/products/${fixture.id}/archive`, 'staff');
  assert.equal(staffArchive.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/archive',
    role: 'staff',
    status: staffArchive.status,
  });
  await assertFingerprintMatch(
    'staff-archive',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postEnableFingerprint),
  );

  const archiveReason = 'Phase 2 archive verification';
  const adminArchive = await admin.client.request('POST', `/admin/products/${fixture.id}/archive`, {
    json: { reason: archiveReason },
  });
  await assertNoSecretsAndTrack(adminArchive, `/admin/products/${fixture.id}/archive`, 'admin');
  assert.equal(adminArchive.status, 201);
  assertProductDetailContract(adminArchive.body);
  assert.equal(adminArchive.body.archive.archiveReason, archiveReason);
  assert.equal(adminArchive.body.archive.archivedBy?.email, roleInputs.admin.email);
  assert.equal(adminArchive.body.effectiveStatus, 'ARCHIVED');
  summary.roleAccessResults.push({
    route: '/admin/products/:id/archive',
    role: 'admin',
    status: adminArchive.status,
  });
  summary.mutationResults.push({
    operation: 'admin-archive-product',
    productId: fixture.id,
    archiveReason,
    archivedBy: adminArchive.body.archive.archivedBy?.email,
  });
  const postArchiveFingerprint = await getFingerprint();
  await assertNoDisallowedDrift('admin-archive-product');

  const archivedUpdate = await admin.client.request('PATCH', `/admin/products/${fixture.id}`, {
    json: { name: `${secondaryAdminUpdatedName}_Archived` },
  });
  await assertNoSecretsAndTrack(archivedUpdate, `/admin/products/${fixture.id}`, 'admin');
  assert.equal(archivedUpdate.status, 400);
  summary.validationResults.push({
    case: 'update-archived-product',
    status: archivedUpdate.status,
    message: sanitizeMessage(archivedUpdate.body?.message),
  });
  await assertFingerprintMatch(
    'archived-update',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postArchiveFingerprint),
  );

  const archivedManual = await admin.client.request(
    'PATCH',
    `/admin/products/${fixture.id}/manual-availability`,
    {
      json: { isEnabled: false },
    },
  );
  await assertNoSecretsAndTrack(
    archivedManual,
    `/admin/products/${fixture.id}/manual-availability`,
    'admin',
  );
  assert.equal(archivedManual.status, 400);
  summary.validationResults.push({
    case: 'manual-availability-archived-product',
    status: archivedManual.status,
    message: sanitizeMessage(archivedManual.body?.message),
  });
  await assertFingerprintMatch(
    'archived-manual',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postArchiveFingerprint),
  );

  const unauthRestore = await unauthenticated.request(
    'POST',
    `/admin/products/${fixture.id}/restore`,
  );
  await assertNoSecretsAndTrack(
    unauthRestore,
    `/admin/products/${fixture.id}/restore`,
    'unauthenticated',
  );
  assert.equal(unauthRestore.status, 401);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/restore',
    role: 'unauthenticated',
    status: unauthRestore.status,
  });
  await assertFingerprintMatch(
    'unauth-restore',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postArchiveFingerprint),
  );

  const staffRestore = await staffAgain.client.request(
    'POST',
    `/admin/products/${fixture.id}/restore`,
  );
  await assertNoSecretsAndTrack(staffRestore, `/admin/products/${fixture.id}/restore`, 'staff');
  assert.equal(staffRestore.status, 403);
  summary.roleAccessResults.push({
    route: '/admin/products/:id/restore',
    role: 'staff',
    status: staffRestore.status,
  });
  await assertFingerprintMatch(
    'staff-restore',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(postArchiveFingerprint),
  );

  const secondaryAdminRestore = await secondaryAdmin.client.request(
    'POST',
    `/admin/products/${fixture.id}/restore`,
  );
  await assertNoSecretsAndTrack(
    secondaryAdminRestore,
    `/admin/products/${fixture.id}/restore`,
    'secondary-admin',
  );
  assert.equal(secondaryAdminRestore.status, 201);
  assertProductDetailContract(secondaryAdminRestore.body);
  assert.equal(secondaryAdminRestore.body.archive.archivedAt, null);
  assert.equal(secondaryAdminRestore.body.archive.archiveReason, null);
  assert.equal(secondaryAdminRestore.body.archive.archivedBy, null);
  assert.equal(secondaryAdminRestore.body.effectiveStatus, 'NO_VALID_RECIPE');
  summary.roleAccessResults.push({
    route: '/admin/products/:id/restore',
    role: 'secondary-admin',
    status: secondaryAdminRestore.status,
  });
  summary.mutationResults.push({
    operation: 'secondary-admin-restore-product',
    productId: fixture.id,
    effectiveStatus: secondaryAdminRestore.body.effectiveStatus,
  });
  const finalFingerprint = await getFingerprint();
  await assertNoDisallowedDrift('secondary-admin-restore-product');

  const adminRestoreConflict = await admin.client.request(
    'POST',
    `/admin/products/${fixture.id}/restore`,
  );
  await assertNoSecretsAndTrack(
    adminRestoreConflict,
    `/admin/products/${fixture.id}/restore`,
    'admin',
  );
  assert.equal(adminRestoreConflict.status, 409);
  summary.validationResults.push({
    case: 'restore-active-product-conflict',
    status: adminRestoreConflict.status,
    message: sanitizeMessage(adminRestoreConflict.body?.message),
  });
  await assertFingerprintMatch(
    'admin-restore-conflict',
    normalizeNonSessionFingerprint,
    normalizeNonSessionFingerprint(finalFingerprint),
  );

  const changedProducts = await getChangedProductsSince(baselineLatestDates.products);
  const changedVariants = await getChangedVariantsSince(baselineLatestDates.variants);
  const changedVariantSummaries = await getChangedVariantSummariesSince(
    baselineLatestDates.variantSummaries,
  );
  const changedVariantEvents = await getChangedVariantEventsSince(
    baselineLatestDates.variantEvents,
  );

  const fixtureVariantIds = new Set(summary.fixture.variantIds);
  const fixtureVariantEvents = await getFixtureVariantEvents([
    ...fixtureVariantIds,
  ]);
  assert.equal(changedProducts.every((product) => product.id === fixture.id), true);
  assert.equal(
    changedVariants.every((variant) => fixtureVariantIds.has(variant.id)),
    true,
  );
  assert.equal(
    changedVariantSummaries.every((summaryRow) =>
      fixtureVariantIds.has(summaryRow.productVariantId),
    ),
    true,
  );
  assert.equal(
    changedVariantEvents.every((event) =>
      fixtureVariantIds.has(event.productVariantId),
    ),
    true,
  );
  assert.equal(
    finalFingerprint.tableStates.products.count,
    baselineFingerprint.tableStates.products.count + 1,
  );
  assert.equal(
    finalFingerprint.tableStates.product_variants.count,
    baselineFingerprint.tableStates.product_variants.count +
      validCreatePayload.initialVariants.length,
  );
  assert.equal(
    finalFingerprint.tableStates.variant_availability_summaries.count,
    baselineFingerprint.tableStates.variant_availability_summaries.count +
      validCreatePayload.initialVariants.length,
  );
  assert.equal(
    finalFingerprint.tableStates.stockout_events.count,
    baselineFingerprint.tableStates.stockout_events.count,
  );
  assert.equal(
    finalFingerprint.tableStates.variant_availability_events.count,
    baselineFingerprint.tableStates.variant_availability_events.count +
      validCreatePayload.initialVariants.length,
  );
  assert.equal(
    fixtureVariantEvents.length >= validCreatePayload.initialVariants.length,
    true,
  );

  await logoutRole('admin', admin.client, admin.sessionId);
  await logoutRole('secondaryAdmin', secondaryAdmin.client, secondaryAdmin.sessionId);
  await logoutRole('staff', staffAgain.client, staffAgain.sessionId);

  summary.finalFingerprint = finalFingerprint;
  summary.fixtureSnapshot = await getFixtureSnapshot(fixture.id);
  summary.changedRows = {
    products: changedProducts,
    variants: changedVariants,
    variantSummaries: changedVariantSummaries,
    variantEvents: changedVariantEvents,
    fixtureVariantEvents,
  };

  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  try {
    if (process.argv[2] === 'print-fingerprint') {
      console.log(JSON.stringify(await getFingerprint(), null, 2));
      return;
    }

    await runMutationTests();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
