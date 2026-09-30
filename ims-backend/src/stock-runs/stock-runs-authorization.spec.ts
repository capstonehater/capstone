import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { StockRunsController } from './stock-runs.controller';
import { StockRunsService } from './stock-runs.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionResolver } from '../auth/rbac/permission-resolver.service';
import {
  PERMISSION_CATALOG,
  type PermissionKey,
} from '../auth/rbac/permission-catalog';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

// No real sessions, environment secrets, database, or business mutations in this suite.
jest.mock('../config/env.validation', () => ({
  env: { SESSION_COOKIE_NAME: 'test_session' },
}));
const routes = [
  {
    controller: StockRunsController,
    handler: 'createStockRun',
    method: 'post',
    path: '/stock-runs',
    permission: 'stockRuns.create',
  },
  {
    controller: StockRunsController,
    handler: 'updateStockRun',
    method: 'patch',
    path: '/stock-runs/run-1',
    permission: 'stockRuns.edit',
  },
  {
    controller: StockRunsController,
    handler: 'addStockRunItem',
    method: 'post',
    path: '/stock-runs/run-1/items',
    permission: 'stockRuns.edit',
  },
  {
    controller: StockRunsController,
    handler: 'deleteStockRunItem',
    method: 'delete',
    path: '/stock-runs/run-1/items/item-1',
    permission: 'stockRuns.edit',
  },
  {
    controller: StockRunsController,
    handler: 'removeStockRunDraft',
    method: 'post',
    path: '/stock-runs/drafts/run-1/delete',
    permission: 'stockRuns.delete',
  },
  {
    controller: StockRunsController,
    handler: 'deleteStockRunDraft',
    method: 'delete',
    path: '/stock-runs/run-1/draft',
    permission: 'stockRuns.delete',
  },
  {
    controller: StockRunsController,
    handler: 'deleteStockRun',
    method: 'delete',
    path: '/stock-runs/run-1',
    permission: 'stockRuns.delete',
  },
  {
    controller: StockRunsController,
    handler: 'postStockRun',
    method: 'post',
    path: '/stock-runs/run-1/post',
    permission: 'stockRuns.post',
  },
  {
    controller: StockRunsController,
    handler: 'listStockRuns',
    method: 'get',
    path: '/stock-runs',
    permission: 'stockRuns.view',
  },
  {
    controller: StockRunsController,
    handler: 'getStockRun',
    method: 'get',
    path: '/stock-runs/run-1',
    permission: 'stockRuns.view',
  },
] as const;
const serviceMethods = [
  'createStockRun',
  'updateStockRun',
  'addStockRunItem',
  'deleteStockRunItem',
  'deleteDraftStockRun',
  'postStockRun',
  'listStockRuns',
  'getStockRunById',
];
describe('Stock Run endpoint authorization (real HTTP guards and resolver)', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const stockRunService = Object.fromEntries(
    serviceMethods.map((name) => [
      name,
      jest.fn().mockResolvedValue({ ok: true }),
    ]),
  );
  const allCalls = () =>
    Object.values(stockRunService).reduce(
      (sum, fn) => sum + fn.mock.calls.length,
      0,
    );
  const send = (
    route: {
      method: 'get' | 'post' | 'put' | 'patch' | 'delete';
      path: string;
    },
    authenticated = true,
  ) => {
    const call = request(app.getHttpServer() as Server)[route.method](
      route.path,
    );
    if (authenticated) call.set('Cookie', 'test_session=valid');
    return call.send({});
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StockRunsController],
      providers: [
        { provide: StockRunsService, useValue: stockRunService },
        { provide: PrismaService, useValue: { user: { findUnique } } },
        { provide: SessionService, useValue: { validateSession } },
        PermissionResolver,
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
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
      role: Role.STAFF,
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
              id: 'custom-role',
              key: 'custom',
              name: 'Custom role',
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
    '$method $path has exactly its mapped permission and no conflicting policy',
    (route) => {
      const reflector = new Reflector();
      const prototype = route.controller.prototype as unknown as Record<
        string,
        object
      >;
      expect(
        reflector.get(REQUIRED_PERMISSIONS_KEY, prototype[route.handler]),
      ).toEqual([route.permission]);
      for (const target of [prototype[route.handler], route.controller]) {
        expect(reflector.get(ROLES_KEY, target)).toBeUndefined();
        expect(reflector.get(IS_PUBLIC_KEY, target)).toBeUndefined();
      }
    },
  );
  it('covers every stock-run controller handler', () => {
    const methods = Object.getOwnPropertyNames(
      StockRunsController.prototype,
    ).filter((name) => name !== 'constructor');
    expect(methods.sort()).toEqual(
      routes
        .filter((route) => route.controller === StockRunsController)
        .map((route) => route.handler)
        .sort(),
    );
  });
  it.each(routes)(
    'Administrator with catalog grants can call $method $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      grants = PERMISSION_CATALOG.map((item) => item.key);
      const response = await send(route);
      expect(response.status).toBe(route.method === 'post' ? 201 : 200);
      expect(allCalls()).toBe(1);
    },
  );
  it.each(routes)(
    'custom role with exact grant can call $method $path without legacy admin authority',
    async (route) => {
      grants = [route.permission];
      const response = await send(route);
      expect(response.status).toBe(route.method === 'post' ? 201 : 200);
      expect(allCalls()).toBe(1);
    },
  );
  it.each(routes)(
    'no permission blocks $method $path before business services',
    async (route) => {
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it.each(routes)('no session returns 401 for $method $path', async (route) => {
    await send(route, false).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(allCalls()).toBe(0);
  });
  it.each(routes.filter((route) => route.method !== 'get'))(
    'view-only custom role cannot mutate $method $path',
    async (route) => {
      grants = ['stockRuns.view'];
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it('legacy Administrator label cannot bypass missing stock-run grants', async () => {
    principal.role = Role.ADMINISTRATOR;
    await send(routes[0]).expect(403);
    expect(allCalls()).toBe(0);
  });
  it.each(routes)(
    'Staff with seeded Stock Runs grants retains $method $path',
    async (route) => {
      grants = PERMISSION_CATALOG.filter(
        (item) => item.module === 'stockRuns',
      ).map((item) => item.key);
      await send(route).expect(route.method === 'post' ? 201 : 200);
    },
  );
  it('create alone cannot post and edit alone cannot delete a draft', async () => {
    grants = ['stockRuns.create'];
    await send({ method: 'post', path: '/stock-runs/run-1/post' }).expect(403);
    grants = ['stockRuns.edit'];
    await send({ method: 'delete', path: '/stock-runs/run-1' }).expect(403);
    expect(allCalls()).toBe(0);
  });
  it('posting and creation keep session actor attribution', async () => {
    grants = ['stockRuns.create', 'stockRuns.post'];
    await send({ method: 'post', path: '/stock-runs' }).expect(201);
    await send({ method: 'post', path: '/stock-runs/run-1/post' }).expect(201);
    expect(stockRunService.createStockRun).toHaveBeenCalledWith({}, 'user-1');
    expect(stockRunService.postStockRun).toHaveBeenCalledWith(
      'run-1',
      'user-1',
    );
  });
  it('invalid or revoked session returns 401 before permissions', async () => {
    validateSession.mockResolvedValueOnce(null);
    grants = ['stockRuns.view'];
    await send(routes[0]).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('permission revocation takes effect on the next request', async () => {
    grants = ['stockRuns.view'];
    await send({ method: 'get', path: '/stock-runs' }).expect(200);
    grants = [];
    await send({ method: 'get', path: '/stock-runs' }).expect(403);
    expect(allCalls()).toBe(1);
  });
  it('inactive database identity is denied despite stale session identity', async () => {
    findUnique.mockResolvedValueOnce({
      isActive: false,
      accountStatus: AccountStatus.INACTIVE,
      accessRoles: [],
    });
    await send(routes[0]).expect(403);
    expect(allCalls()).toBe(0);
  });
  it('an unknown database key does not grant edit permission', async () => {
    grants = ['stockRuns.superuser'];
    await send({ method: 'patch', path: '/stock-runs/run-1' }).expect(403);
  });
  it('uses only the five existing stock-run catalog keys', () => {
    const keys = new Set<PermissionKey>(
      routes.map((route) => route.permission),
    );
    expect([...keys].sort()).toEqual(
      PERMISSION_CATALOG.filter((item) => item.module === 'stockRuns')
        .map((item) => item.key)
        .sort(),
    );
  });
});
