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
import { StockRunsController } from '../stock-runs/stock-runs.controller';
import { StockRunsService } from '../stock-runs/stock-runs.service';
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
    handler: 'storeAvailability',
    method: 'get',
    path: '/raw-materials/material-1/store-availability',
    permission: 'suppliers.searchAvailability',
  },
  {
    handler: 'searchStoreAvailability',
    method: 'post',
    path: '/raw-materials/material-1/store-availability',
    permission: 'suppliers.searchAvailability',
  },
  {
    handler: 'listSuppliers',
    method: 'get',
    path: '/suppliers',
    permission: 'suppliers.view',
  },
  {
    handler: 'createSupplier',
    method: 'post',
    path: '/suppliers',
    permission: 'suppliers.create',
  },
  {
    handler: 'updateSupplier',
    method: 'patch',
    path: '/suppliers/supplier-1',
    permission: 'suppliers.edit',
  },
  {
    handler: 'deleteSupplier',
    method: 'delete',
    path: '/suppliers/supplier-1',
    permission: 'suppliers.delete',
  },
] as const;
type Route = { method: 'get' | 'post' | 'patch' | 'delete'; path: string };

describe('Supplier management and discovery HTTP authorization', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const inventory = Object.fromEntries(
    [
      'listUnits',
      'listRawMaterials',
      'getRawMaterialById',
      'listRawMaterialBatches',
      'listInventorySummary',
      'createRawMaterial',
      'updateRawMaterial',
      'archiveRawMaterial',
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
  const receiving = {
    createStockRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
    addStockRunItem: jest.fn().mockResolvedValue({ id: 'item-1' }),
    postStockRun: jest.fn().mockResolvedValue({ id: 'run-1' }),
  };
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
      (route.path === '/suppliers' && route.method === 'post'
        ? { name: 'Supplier' }
        : {});
    return req.send(payload);
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InventoryController, StockRunsController],
      providers: [
        { provide: StockRunsService, useValue: receiving },
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
  it.each(routes.filter((route) => route.permission !== 'suppliers.view'))(
    'supplier view cannot perform $method $path',
    async (route) => {
      grants = ['suppliers.view'];
      await send(route).expect(403);
      expect(calls()).toBe(0);
    },
  );
  it.each(routes)(
    'discovery-only grant permits only discovery: $method $path',
    async (route) => {
      grants = ['suppliers.searchAvailability'];
      const allowed = route.permission === 'suppliers.searchAvailability';
      await send(route).expect(
        allowed ? (route.method === 'post' ? 201 : 200) : 403,
      );
      expect(calls()).toBe(allowed ? 1 : 0);
    },
  );
  it('receiving with read-only supplier access does not gain management authority', async () => {
    principal.role = Role.STAFF;
    grants = [
      'stockRuns.create',
      'stockRuns.edit',
      'stockRuns.post',
      'suppliers.view',
    ];
    await send({ method: 'get', path: '/suppliers' }).expect(200);
    await send({ method: 'post', path: '/suppliers' }).expect(403);
    await send({ method: 'patch', path: '/suppliers/supplier-1' }).expect(403);
    await send({ method: 'delete', path: '/suppliers/supplier-1' }).expect(403);
  });
  it('receiving mutations need no supplier management or discovery grants', async () => {
    grants = ['stockRuns.create', 'stockRuns.edit', 'stockRuns.post'];
    await send({ method: 'post', path: '/stock-runs' }, true, {
      name: 'Delivery',
    }).expect(201);
    await send({ method: 'post', path: '/stock-runs/run-1/items' }, true, {
      rawMaterialId: 'material-1',
      supplierId: 'supplier-1',
      quantity: 2,
      costPerUnit: 3,
    }).expect(201);
    await send({ method: 'post', path: '/stock-runs/run-1/post' }).expect(201);
    expect(receiving.addStockRunItem).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ supplierId: 'supplier-1' }),
    );
    await send({ method: 'get', path: '/suppliers' }).expect(403);
  });
  it('supplier coordinates retain DTO validation', async () => {
    grants = ['suppliers.create'];
    await send({ method: 'post', path: '/suppliers' }, true, {
      name: 'Test',
      latitude: 91,
    }).expect(400);
    expect(calls()).toBe(0);
  });

  it('revocation takes effect on the next request', async () => {
    grants = ['suppliers.searchAvailability'];
    await send(routes[0]).expect(200);
    grants = [];
    await send(routes[0]).expect(403);
    expect(calls()).toBe(1);
  });
  it('invalid session fails before permission lookup', async () => {
    validateSession.mockResolvedValueOnce(null);
    grants = ['suppliers.searchAvailability'];
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
  it('uses exactly the five current Supplier catalog keys', () => {
    expect(
      [...new Set(routes.map((route) => route.permission))].sort(),
    ).toEqual(
      PERMISSION_CATALOG.filter((item) => item.module === 'suppliers')
        .map((item) => item.key)
        .sort(),
    );
  });
});
