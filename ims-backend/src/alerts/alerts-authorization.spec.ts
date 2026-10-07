import 'reflect-metadata';
import {
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  InternalServerErrorException,
  RequestMethod,
  SetMetadata,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionResolver } from '../auth/rbac/permission-resolver.service';
import {
  PERMISSION_CATALOG,
  type PermissionKey,
} from '../auth/rbac/permission-catalog';
import {
  RequirePermission,
  REQUIRED_PERMISSIONS_KEY,
} from '../auth/decorators/require-permission.decorator';
import { Roles, ROLES_KEY } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

// Real HTTP controller, validation, global guards and resolver; no live database,
// real sessions, background jobs, or alert mutations.
jest.mock('../config/env.validation', () => ({
  env: { SESSION_COOKIE_NAME: 'test_session' },
}));

const routes = [
  {
    handler: 'listAlerts',
    method: 'get',
    path: '/alerts',
    permission: 'alerts.view',
  },
  {
    handler: 'getUnreadCount',
    method: 'get',
    path: '/alerts/unread-count',
    permission: 'alerts.view',
  },
  {
    handler: 'acknowledgeAlert',
    method: 'post',
    path: '/alerts/alert-1/acknowledge',
    permission: 'alerts.acknowledge',
  },
  {
    handler: 'dismissAlert',
    method: 'post',
    path: '/alerts/alert-1/dismiss',
    permission: 'alerts.dismiss',
  },
  { handler: 'deleteResolvedAlerts', method: 'post', path: '/alerts/resolved/delete', permission: 'alerts.dismiss' },
] as const;

const permissionCases: { label: string; grants: PermissionKey[] }[] = [
  { label: 'no grants', grants: [] },
  { label: 'view only', grants: ['alerts.view'] },
  { label: 'acknowledge only', grants: ['alerts.acknowledge'] },
  { label: 'dismiss only', grants: ['alerts.dismiss'] },
  {
    label: 'view and acknowledge',
    grants: ['alerts.view', 'alerts.acknowledge'],
  },
  { label: 'view and dismiss', grants: ['alerts.view', 'alerts.dismiss'] },
  {
    label: 'both actions only',
    grants: ['alerts.acknowledge', 'alerts.dismiss'],
  },
  {
    label: 'all alert grants',
    grants: ['alerts.view', 'alerts.acknowledge', 'alerts.dismiss'],
  },
];

class InvalidPolicyFixture {
  @SetMetadata(REQUIRED_PERMISSIONS_KEY, ['alerts.unknown'])
  unknown(this: void) {
    return true;
  }

  @RequirePermission('alerts.view', 'alerts.acknowledge')
  allOf(this: void) {
    return true;
  }
}

@Roles(Role.ADMINISTRATOR)
class MixedPolicyFixture {
  @RequirePermission('alerts.view')
  read(this: void) {
    return true;
  }
}

describe('Alerts HTTP authorization', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const alertService = {
    listAlerts: jest.fn().mockResolvedValue([{ id: 'alert-1' }]),
    getUnreadCount: jest.fn().mockResolvedValue({ count: 3 }),
    acknowledgeAlert: jest.fn().mockResolvedValue({ id: 'alert-1' }),
    dismissAlert: jest.fn().mockResolvedValue({ id: 'alert-1' }),
    deleteResolvedAlerts: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const calls = () =>
    Object.values(alertService).reduce(
      (total, handler) => total + handler.mock.calls.length,
      0,
    );
  const send = (
    route: { method: 'get' | 'post'; path: string },
    token: string | null = 'valid',
    body: object = route.path === '/alerts/resolved/delete' ? { ids: ['alert-1'] } : {},
  ) => {
    const req = request(app.getHttpServer() as Server)[route.method](
      route.path,
    );
    if (token !== null) req.set('Cookie', `test_session=${token}`);
    return req.send(body);
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AlertsController],
      providers: [
        { provide: AlertsService, useValue: alertService },
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

  it('covers every HTTP handler, including both reads and both actions', () => {
    const reflector = new Reflector();
    const proto = AlertsController.prototype;
    const handlers = Object.getOwnPropertyNames(proto).filter((name) => {
      const value: unknown = Object.getOwnPropertyDescriptor(
        proto,
        name,
      )?.value;
      return (
        typeof value === 'function' &&
        reflector.get(METHOD_METADATA, value) !== undefined
      );
    });
    expect(handlers.sort()).toEqual(
      routes.map((route) => route.handler).sort(),
    );
    expect(reflector.get(PATH_METADATA, AlertsController)).toBe('alerts');
    for (const route of routes) {
      const handler = proto[route.handler];
      const expectedPath =
        route.path.replace(/^\/alerts\/?/, '').replace('alert-1', ':id') || '/';
      expect(reflector.get(PATH_METADATA, handler)).toBe(expectedPath);
      expect(reflector.get(METHOD_METADATA, handler)).toBe(
        route.method === 'get' ? RequestMethod.GET : RequestMethod.POST,
      );
    }
  });

  it.each(routes)(
    '$method $path declares only its exact permission',
    (route) => {
      const reflector = new Reflector();
      const handler = AlertsController.prototype[route.handler];
      expect(reflector.get(REQUIRED_PERMISSIONS_KEY, handler)).toEqual([
        route.permission,
      ]);
      expect(
        reflector.get(REQUIRED_PERMISSIONS_KEY, AlertsController),
      ).toBeUndefined();
      for (const target of [handler, AlertsController]) {
        expect(reflector.get(ROLES_KEY, target)).toBeUndefined();
        expect(reflector.get(IS_PUBLIC_KEY, target)).toBeUndefined();
      }
    },
  );

  it.each(routes)(
    'no session denies $method $path before any lookup',
    async (route) => {
      grants = ['alerts.view', 'alerts.acknowledge', 'alerts.dismiss'];
      await send(route, null).expect(401);
      expect(validateSession).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
      expect(calls()).toBe(0);
    },
  );

  it.each(routes)('invalid session denies $method $path', async (route) => {
    await send(route, 'invalid').expect(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(calls()).toBe(0);
  });

  it.each(
    [Role.STAFF, Role.MANAGER, Role.ADMINISTRATOR].flatMap((role) =>
      permissionCases.map((entry) => ({
        ...entry,
        role,
        name: `${role}: ${entry.label}`,
      })),
    ),
  )('$name enforces the exact operation matrix', async (entry) => {
    principal.role = entry.role;
    grants = entry.grants;
    for (const route of routes) {
      Object.values(alertService).forEach((handler) => handler.mockClear());
      const allowed = grants.includes(route.permission);
      await send(route).expect(
        allowed ? (route.method === 'post' ? 201 : 200) : 403,
      );
      expect(calls()).toBe(allowed ? 1 : 0);
      expect(alertService[route.handler]).toHaveBeenCalledTimes(
        allowed ? 1 : 0,
      );
    }
  });

  it.each(routes)(
    'unrelated and unknown grants cannot authorize $path',
    async (route) => {
      grants = ['dashboard.view', 'inventory.view', 'alerts.unknown'];
      await send(route).expect(403);
      expect(calls()).toBe(0);
    },
  );

  it.each(routes)(
    'revocation applies to the next request on $path',
    async (route) => {
      grants = [route.permission];
      await send(route).expect(route.method === 'post' ? 201 : 200);
      grants = [];
      await send(route).expect(403);
      expect(calls()).toBe(1);
      expect(findUnique).toHaveBeenCalledTimes(2);
    },
  );

  it.each(routes)(
    'inactive identity cannot use stale session grants on $path',
    async (route) => {
      findUnique.mockResolvedValueOnce({
        isActive: false,
        accountStatus: AccountStatus.INACTIVE,
        accessRoles: [],
      });
      await send(route).expect(403);
      expect(calls()).toBe(0);
    },
  );

  it('preserves filter forwarding and the list/count response envelopes', async () => {
    grants = ['alerts.view'];
    await send({
      method: 'get',
      path: '/alerts?type=LOW_STOCK&state=ACTIVE&severity=WARNING&rawMaterialId=material-1&stockBatchId=batch-1&search=coffee&limit=5',
    }).expect(200, { alerts: [{ id: 'alert-1' }] });
    expect(alertService.listAlerts).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'LOW_STOCK',
        state: 'ACTIVE',
        severity: 'WARNING',
        rawMaterialId: 'material-1',
        stockBatchId: 'batch-1',
        search: 'coffee',
        limit: 5,
      }),
    );
    await send(routes[1]).expect(200, { count: 3 });
    expect(alertService.getUnreadCount).toHaveBeenCalledWith();
  });

  it.each(routes.filter((route) => route.method === 'post' && route.handler !== 'deleteResolvedAlerts'))(
    '$path keeps the authenticated actor, optional note and response envelope',
    async (route) => {
      grants = [route.permission];
      await send(route, 'valid', { note: 'Reviewed' }).expect(201, {
        alert: { id: 'alert-1' },
      });
      expect(alertService[route.handler]).toHaveBeenLastCalledWith(
        'alert-1',
        principal.id,
        'Reviewed',
      );
      await send(route).expect(201);
      expect(alertService[route.handler]).toHaveBeenLastCalledWith(
        'alert-1',
        principal.id,
        undefined,
      );
    },
  );

  it('deletes a specified resolved selection with its response count', async () => {
    grants = ['alerts.dismiss'];
    await send(routes[4], 'valid', { ids: ['one', 'two'] }).expect(201, { deletedCount: 1 });
    expect(alertService.deleteResolvedAlerts).toHaveBeenCalledWith(['one', 'two']);
  });

  it.each([{}, { ids: [] }, { ids: ['one', 'one'] }, { ids: [123] }, { ids: Array.from({ length: 201 }, (_, i) => String(i)) }, { ids: ['one'], state: 'ACTIVE' }])('rejects invalid deletion payload %j', async (body) => {
    grants = ['alerts.dismiss'];
    await send(routes[4], 'valid', body).expect(400);
    expect(alertService.deleteResolvedAlerts).not.toHaveBeenCalled();
  });

  it.each(['/alerts?state=INVALID', '/alerts?limit=201'])(
    'preserves filter validation on %s',
    async (path) => {
      grants = ['alerts.view'];
      await send({ method: 'get', path }).expect(400);
      expect(calls()).toBe(0);
    },
  );

  it.each(routes.filter((route) => route.method === 'post'))(
    '$path rejects invalid notes and client-supplied actors',
    async (route) => {
      grants = [route.permission];
      for (const body of [
        { note: 'x'.repeat(501) },
        { userId: 'other-user' },
      ]) {
        await send(route, 'valid', body).expect(400);
      }
      expect(calls()).toBe(0);
    },
  );

  it('uses only the three existing Alert catalog keys', () => {
    expect(
      [...new Set(routes.map((route) => route.permission))].sort(),
    ).toEqual(
      PERMISSION_CATALOG.filter((item) => item.module === 'alerts')
        .map((item) => item.key)
        .sort(),
    );
  });

  const context = (handler: () => boolean, controller: object) =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ user: principal }) }),
    }) as unknown as ExecutionContext;
  const guard = () =>
    new PermissionsGuard(new Reflector(), app.get(PermissionResolver));

  it('rejects unknown permission declarations and forged runtime metadata', async () => {
    expect(() => RequirePermission('alerts.unknown' as PermissionKey)).toThrow(
      'Unknown permission key',
    );
    await expect(
      guard().canActivate(
        context(InvalidPolicyFixture.prototype.unknown, InvalidPolicyFixture),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('retains rejection of inherited role plus permission metadata', async () => {
    principal.role = Role.ADMINISTRATOR;
    grants = ['alerts.view'];
    await expect(
      guard().canActivate(
        context(MixedPolicyFixture.prototype.read, MixedPolicyFixture),
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('preserves all-of semantics without adding view to action endpoints', async () => {
    const ctx = context(
      InvalidPolicyFixture.prototype.allOf,
      InvalidPolicyFixture,
    );
    grants = ['alerts.acknowledge'];
    await expect(guard().canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    grants = ['alerts.view', 'alerts.acknowledge'];
    await expect(guard().canActivate(ctx)).resolves.toBe(true);
  });
});
