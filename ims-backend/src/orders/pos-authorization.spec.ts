import 'reflect-metadata';
import { CatalogController } from '../catalog/catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
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
    controller: OrdersController,
    handler: 'updateCashPayment',
    method: 'patch',
    path: '/orders/order-1/cash-payment',
    permission: 'pos.checkout',
  },
  {
    controller: CatalogController,
    handler: 'getPosMenu',
    method: 'get',
    path: '/pos/menu',
    permission: 'pos.view',
  },
  {
    controller: OrdersController,
    handler: 'checkout',
    method: 'post',
    path: '/pos/checkout',
    permission: 'pos.checkout',
  },
  {
    controller: OrdersController,
    handler: 'listOrders',
    method: 'get',
    path: '/orders',
    permission: 'pos.orders.view',
  },
  {
    controller: OrdersController,
    handler: 'getOrderById',
    method: 'get',
    path: '/orders/order-1',
    permission: 'pos.orders.view',
  },
  {
    controller: OrdersController,
    handler: 'refundOrder',
    method: 'post',
    path: '/orders/order-1/refund',
    permission: 'pos.refund',
  },
] as const;
const serviceMethods = [
  'updateCashPayment',
  'getPosMenu',
  'checkout',
  'listOrders',
  'getOrderById',
  'refundOrder',
];
describe('POS endpoint authorization (real HTTP guards and resolver)', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const orderService = Object.fromEntries(
    serviceMethods.map((name) => [
      name,
      jest.fn().mockResolvedValue({ ok: true }),
    ]),
  );
  const allCalls = () =>
    Object.values(orderService).reduce(
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
      controllers: [OrdersController, CatalogController],
      providers: [
        { provide: OrdersService, useValue: orderService },
        { provide: CatalogService, useValue: orderService },
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

  it.each(routes)('$path has exactly its mapped policy', (route) => {
    const reflector = new Reflector();
    const prototype = route.controller.prototype as unknown as Record<
      string,
      object
    >;
    expect(
      reflector.getAllAndOverride(REQUIRED_PERMISSIONS_KEY, [
        prototype[route.handler],
        route.controller,
      ]),
    ).toEqual([route.permission]);
    for (const target of [prototype[route.handler], route.controller]) {
      expect(reflector.get(ROLES_KEY, target)).toBeUndefined();
      expect(reflector.get(IS_PUBLIC_KEY, target)).toBeUndefined();
    }
  });
  it('accounts for every Orders handler', () => {
    expect(
      Object.getOwnPropertyNames(OrdersController.prototype)
        .filter((name) => name !== 'constructor')
        .sort(),
    ).toEqual(
      routes
        .filter((route) => route.controller === OrdersController)
        .map((route) => route.handler)
        .sort(),
    );
  });
  it.each(routes)('Administrator with grants can call $path', async (route) => {
    principal.role = Role.ADMINISTRATOR;
    grants = [route.permission];
    await send(route).expect(route.method === 'post' ? 201 : 200);
    expect(orderService[route.handler]).toHaveBeenCalledTimes(1);
  });
  it.each(routes)(
    'custom role with exact grant can call $path',
    async (route) => {
      principal.role = Role.MANAGER;
      grants = [route.permission];
      await send(route).expect(route.method === 'post' ? 201 : 200);
      expect(allCalls()).toBe(1);
    },
  );
  it.each(routes)('missing permission denies $path', async (route) => {
    await send(route).expect(403);
    expect(allCalls()).toBe(0);
  });
  it.each(routes)('no session denies $path', async (route) => {
    grants = [route.permission];
    await send(route, false).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(allCalls()).toBe(0);
  });
  it.each(routes)(
    'legacy Administrator cannot bypass grants on $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it.each(routes)('seeded Staff retains $path', async (route) => {
    grants = ['pos.view', 'pos.checkout', 'pos.orders.view', 'pos.refund'];
    await send(route).expect(route.method === 'post' ? 201 : 200);
  });
  it.each([
    'pos.view',
    'pos.checkout',
    'pos.orders.view',
    'pos.refund',
  ] as PermissionKey[])(
    '%s permits only its own operations',
    async (permission) => {
      grants = [permission];
      for (const route of routes) {
        await send(route).expect(
          route.permission === permission
            ? route.method === 'post'
              ? 201
              : 200
            : 403,
        );
      }
      expect(allCalls()).toBe(
        routes.filter((route) => route.permission === permission).length,
      );
    },
  );
  it('reports.view does not grant operational history or refund access', async () => {
    grants = ['reports.view'];
    for (const route of routes) await send(route).expect(403);
    expect(allCalls()).toBe(0);
  });
  it('queued checkout and replay require current grants on every retry', async () => {
    const payload = {
      idempotencyKey: 'offline-checkout-1',
      items: [],
      payments: [],
    };
    const checkout = () =>
      request(app.getHttpServer() as Server)
        .post('/pos/checkout')
        .set('Cookie', 'test_session=valid')
        .send(payload);
    grants = ['pos.checkout'];
    await checkout().expect(201);
    expect(orderService.checkout).toHaveBeenCalledWith(payload, 'user-1');
    grants = [];
    await checkout().expect(403);
    await checkout().expect(403);
    expect(orderService.checkout).toHaveBeenCalledTimes(1);
  });
  it.each(routes)(
    'revocation denies the next request on $path',
    async (route) => {
      grants = [route.permission];
      await send(route).expect(route.method === 'post' ? 201 : 200);
      grants = [];
      await send(route).expect(403);
      expect(allCalls()).toBe(1);
    },
  );
  it('refund keeps order and session actor attribution', async () => {
    grants = ['pos.refund'];
    await send(routes.find(route => route.handler === 'refundOrder')!).expect(201);
    expect(orderService.refundOrder).toHaveBeenCalledWith(
      'order-1',
      {},
      'user-1',
    );
  });
  it('invalid session is denied before permission resolution', async () => {
    validateSession.mockResolvedValueOnce(null);
    grants = ['pos.checkout'];
    await send(routes.find(route => route.handler === 'checkout')!).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('inactive identity cannot checkout', async () => {
    findUnique.mockResolvedValueOnce({
      isActive: false,
      accountStatus: AccountStatus.INACTIVE,
      accessRoles: [],
    });
    await send(routes.find(route => route.handler === 'checkout')!).expect(403);
    expect(allCalls()).toBe(0);
  });
  it('unknown grants cannot authorize checkout', async () => {
    grants = ['pos.superuser'];
    await send(routes.find(route => route.handler === 'checkout')!).expect(403);
  });
  it('uses exactly the existing four POS keys', () => {
    expect(
      [...new Set(routes.map((route) => route.permission))].sort(),
    ).toEqual(
      PERMISSION_CATALOG.filter((item) => item.module === 'pos')
        .map((item) => item.key)
        .sort(),
    );
  });
});
