import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryActionsService } from './inventory-actions.service';
import { StoreAvailabilityService } from './store-availability.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionResolver } from '../auth/rbac/permission-resolver.service';
import { PERMISSION_CATALOG } from '../auth/rbac/permission-catalog';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

jest.mock('../config/env.validation', () => ({
  env: { SESSION_COOKIE_NAME: 'test_session' },
}));
const routes = [
  {
    handler: 'listUnits',
    method: 'get',
    path: '/units',
    permission: 'inventory.view',
  },
  {
    handler: 'listRawMaterials',
    method: 'get',
    path: '/raw-materials',
    permission: 'inventory.view',
  },
  {
    handler: 'getRawMaterial',
    method: 'get',
    path: '/raw-materials/material-1',
    permission: 'inventory.view',
  },
  {
    handler: 'listRawMaterialBatches',
    method: 'get',
    path: '/raw-materials/material-1/batches',
    permission: 'inventory.view',
  },
  {
    handler: 'listRawMaterialTransactions',
    method: 'get',
    path: '/raw-materials/material-1/transactions',
    permission: 'inventory.view',
  },
  {
    handler: 'listBatchTransactions',
    method: 'get',
    path: '/stock-batches/batch-1/transactions',
    permission: 'inventory.view',
  },
  {
    handler: 'listInventorySummary',
    method: 'get',
    path: '/inventory/summary',
    permission: 'inventory.view',
  },
  {
    handler: 'listInventoryTransactions',
    method: 'get',
    path: '/inventory/transactions',
    permission: 'inventory.view',
  },
  {
    handler: 'createRawMaterial',
    method: 'post',
    path: '/raw-materials',
    permission: 'inventory.create',
  },
  {
    handler: 'createUnit',
    method: 'post',
    path: '/units',
    permission: 'inventory.create',
  },
  {
    handler: 'createUnitForMaterial',
    method: 'post',
    path: '/raw-materials/material-1/units',
    permission: 'inventory.edit',
  },
  {
    handler: 'updateRawMaterial',
    method: 'patch',
    path: '/raw-materials/material-1',
    permission: 'inventory.edit',
  },
  {
    handler: 'archiveRawMaterial',
    method: 'delete',
    path: '/raw-materials/material-1',
    permission: 'inventory.archive',
  },
  {
    handler: 'logWaste',
    method: 'post',
    path: '/inventory/waste',
    permission: 'inventory.waste',
  },
  {
    handler: 'unarchiveRawMaterial',
    method: 'post',
    path: '/raw-materials/material-1/unarchive',
    permission: 'inventory.archive',
  },
  {
    handler: 'deleteRawMaterial',
    method: 'delete',
    path: '/raw-materials/material-1/permanent',
    permission: 'inventory.archive',
  },
] as const;
const legacy = [
  {
    handler: 'storeAvailability',
    method: 'get',
    path: '/raw-materials/material-1/store-availability',
    roles: [Role.ADMINISTRATOR],
  },
  {
    handler: 'searchStoreAvailability',
    method: 'post',
    path: '/raw-materials/material-1/store-availability',
    roles: [Role.ADMINISTRATOR],
  },
  {
    handler: 'listSuppliers',
    method: 'get',
    path: '/suppliers',
    roles: [Role.ADMINISTRATOR, Role.STAFF],
  },
  {
    handler: 'createSupplier',
    method: 'post',
    path: '/suppliers',
    roles: [Role.ADMINISTRATOR],
  },
  {
    handler: 'updateSupplier',
    method: 'patch',
    path: '/suppliers/supplier-1',
    roles: [Role.ADMINISTRATOR],
  },
  {
    handler: 'deleteSupplier',
    method: 'delete',
    path: '/suppliers/supplier-1',
    roles: [Role.ADMINISTRATOR],
  },
] as const;
type Route = { method: 'get' | 'post' | 'patch' | 'delete'; path: string };
const waste = {
  rawMaterialId: 'material-1',
  batchId: 'batch-1',
  quantity: 1,
  reasonCode: 'SPOILAGE',
};
const material = { name: 'Material', sku: 'RM-1', unitId: 'unit-1' };

describe('Inventory material HTTP authorization', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const inventory = Object.fromEntries(
    [
      'listUnits',
      'createUnit',
      'createUnitForMaterial',
      'listRawMaterials',
      'getRawMaterialById',
      'listRawMaterialBatches',
      'listInventorySummary',
      'createRawMaterial',
      'updateRawMaterial',
      'archiveRawMaterial',
      'unarchiveRawMaterial',
      'deleteRawMaterial',
      'listSuppliers',
      'createSupplier',
      'updateSupplier',
      'deleteSupplier',
    ].map((name) => [name, jest.fn().mockResolvedValue({ ok: true })]),
  );
  const actions = Object.fromEntries(
    [
      'listTransactionsForRawMaterial',
      'listTransactionsForBatch',
      'listTransactions',
      'logWaste',
    ].map((name) => [name, jest.fn().mockResolvedValue({ ok: true })]),
  );
  const stores = {
    latest: jest.fn().mockResolvedValue(null),
    start: jest.fn().mockResolvedValue({ id: 'search-1' }),
  };
  const calls = () =>
    [
      ...Object.values(inventory),
      ...Object.values(actions),
      ...Object.values(stores),
    ].reduce((sum, fn) => sum + fn.mock.calls.length, 0);
  const send = (route: Route, authenticated = true, body?: object) => {
    const req = request(app.getHttpServer() as Server)[route.method](
      route.path,
    );
    if (authenticated) req.set('Cookie', 'test_session=valid');
    const payload =
      body ??
      (route.path === '/inventory/waste'
        ? waste
        : route.path === '/raw-materials' && route.method === 'post'
          ? material
          : route.path === '/units' || route.path.endsWith('/units')
            ? { name: 'Kilogram', code: 'KG', dimension: 'MASS' }
            : route.path === '/suppliers' && route.method === 'post'
              ? { name: 'Supplier' }
              : {});
    return req.send(payload);
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: inventory },
        { provide: InventoryActionsService, useValue: actions },
        { provide: StoreAvailabilityService, useValue: stores },
        { provide: PrismaService, useValue: { user: { findUnique } } },
        { provide: SessionService, useValue: { validateSession } },
        PermissionResolver,
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    principal = {
      id: 'user-1',
      email: 'test@example.invalid',
      name: 'Test',
      role: Role.MANAGER,
      isActive: true,
      sessionId: 'session-1',
    };
    grants = [];
    validateSession.mockImplementation((token: string) =>
      Promise.resolve(token === 'valid' ? principal : null),
    );
    findUnique.mockImplementation(() =>
      Promise.resolve({
        isActive: true,
        accountStatus: AccountStatus.ACTIVE,
        accessRoles: [
          {
            assignedAt: new Date('2026-01-01'),
            role: {
              id: 'custom',
              key: 'custom',
              name: 'Custom',
              description: '',
              revision: 1,
              permissions: grants.map((key) => ({ permission: { key } })),
            },
          },
        ],
      }),
    );
  });
  it.each(routes)(
    '$method $path has its mapped permission and no legacy/public metadata',
    (route) => {
      const reflector = new Reflector();
      const handler = InventoryController.prototype[route.handler];
      expect(reflector.get(REQUIRED_PERMISSIONS_KEY, handler)).toEqual([
        route.permission,
      ]);
      for (const target of [handler, InventoryController]) {
        expect(reflector.get(ROLES_KEY, target)).toBeUndefined();
        expect(reflector.get(IS_PUBLIC_KEY, target)).toBeUndefined();
      }
    },
  );
  it('accounts for every handler in the mixed inventory controller', () => {
    expect(
      Object.getOwnPropertyNames(InventoryController.prototype)
        .filter((name) => name !== 'constructor')
        .sort(),
    ).toEqual([...routes, ...legacy].map((route) => route.handler).sort());
  });
  it('does not expose inventory history deletion', async () => {
    grants = PERMISSION_CATALOG.map((item) => item.key);
    await send({ method: 'delete', path: '/inventory/transactions/transaction-1' }).expect(404);
    expect(calls()).toBe(0);
  });
  it.each(routes)(
    'Administrator with grants can call $method $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      grants = PERMISSION_CATALOG.map((item) => item.key);
      await send(route).expect(route.method === 'post' ? 201 : 200);
      expect(calls()).toBe(1);
    },
  );
  it.each(routes)(
    'custom role with only exact grant can call $method $path',
    async (route) => {
      grants = [route.permission];
      await send(route).expect(route.method === 'post' ? 201 : 200);
      expect(calls()).toBe(1);
    },
  );
  it.each(routes)(
    'no grants return 403 before business logic for $method $path',
    async (route) => {
      await send(route).expect(403);
      expect(calls()).toBe(0);
    },
  );
  it.each(routes)('no session returns 401 for $method $path', async (route) => {
    await send(route, false).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(calls()).toBe(0);
  });
  it.each(routes)(
    'legacy Administrator without grant is denied for $method $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      await send(route).expect(403);
      expect(calls()).toBe(0);
    },
  );
  it.each(routes.filter((route) => route.method !== 'get'))(
    'view-only cannot mutate $method $path',
    async (route) => {
      grants = ['inventory.view'];
      await send(route).expect(403);
      expect(calls()).toBe(0);
    },
  );
  it.each(routes)(
    'legacy Staff retains seeded read/waste behavior for $method $path',
    async (route) => {
      principal.role = Role.STAFF;
      grants = ['inventory.view', 'inventory.waste'];
      const allowed =
        route.permission === 'inventory.view' ||
        route.permission === 'inventory.waste';
      await send(route).expect(
        allowed ? (route.method === 'post' ? 201 : 200) : 403,
      );
      expect(calls()).toBe(allowed ? 1 : 0);
    },
  );

  it('edit permits material edits but not archive or waste', async () => {
    grants = ['inventory.edit'];
    await send({ method: 'patch', path: '/raw-materials/material-1' }, true, {
      name: 'Renamed',
    }).expect(200);
    await send({ method: 'delete', path: '/raw-materials/material-1' }).expect(
      403,
    );
    await send({ method: 'post', path: '/inventory/waste' }).expect(403);
    expect(calls()).toBe(1);
  });
  it('accepts categoryIds when editing a raw material', async () => {
    grants = ['inventory.edit'];
    const body = { categoryIds: ['category-1', 'category-2'] };
    await send(
      { method: 'patch', path: '/raw-materials/material-1' },
      true,
      body,
    ).expect(200);
    expect(inventory.updateRawMaterial).toHaveBeenCalledWith(
      'material-1',
      body,
    );
  });
  it('does not invent an adjustment endpoint or permission', async () => {
    grants = ['inventory.edit'];
    await send({ method: 'post', path: '/inventory/adjustments' }).expect(404);
    expect(
      PERMISSION_CATALOG.some(
        (item) => (item.key as string) === 'inventory.adjust',
      ),
    ).toBe(false);
  });
  it('waste preserves authenticated actor attribution', async () => {
    grants = ['inventory.waste'];
    await send({ method: 'post', path: '/inventory/waste' }).expect(201);
    expect(actions.logWaste).toHaveBeenCalledWith(
      expect.objectContaining(waste),
      'user-1',
    );
  });
  it.each([0, -1])(
    'waste still rejects invalid quantity %s after authorization',
    async (quantity) => {
      grants = ['inventory.waste'];
      await send({ method: 'post', path: '/inventory/waste' }, true, {
        ...waste,
        quantity,
      }).expect(400);
      expect(calls()).toBe(0);
    },
  );
  it('material edit cannot smuggle archive state through the DTO', async () => {
    grants = ['inventory.edit'];
    await send({ method: 'patch', path: '/raw-materials/material-1' }, true, {
      isActive: false,
    }).expect(400);
    expect(calls()).toBe(0);
  });
  it('revocation takes effect on the next request', async () => {
    grants = ['inventory.view'];
    await send(routes[0]).expect(200);
    grants = [];
    await send(routes[0]).expect(403);
    expect(calls()).toBe(1);
  });
  it('invalid session fails before permission lookup', async () => {
    validateSession.mockResolvedValueOnce(null);
    grants = ['inventory.view'];
    await send(routes[0]).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('inactive database user cannot use stale session grants', async () => {
    findUnique.mockResolvedValueOnce({
      isActive: false,
      accountStatus: AccountStatus.INACTIVE,
      accessRoles: [],
    });
    await send(routes[0]).expect(403);
    expect(calls()).toBe(0);
  });
  it('uses exactly the five current Inventory catalog keys', () => {
    expect(
      [...new Set(routes.map((route) => route.permission))].sort(),
    ).toEqual(
      PERMISSION_CATALOG.filter((item) => item.module === 'inventory')
        .map((item) => item.key)
        .sort(),
    );
  });
});
