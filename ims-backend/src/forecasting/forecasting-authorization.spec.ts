import 'reflect-metadata';
import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { ForecastingController } from './forecasting.controller';
import { ForecastingService } from './forecasting.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SessionService } from '../auth/session.service';
import { PermissionResolver } from '../auth/rbac/permission-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

jest.mock('../config/env.validation', () => ({
  env: { SESSION_COOKIE_NAME: 'test_session' },
}));

const routes = [
  { handler: 'products', method: 'get', path: 'products' },
  { handler: 'latest', method: 'get', path: 'latest' },
  { handler: 'run', method: 'get', path: 'runs/:id' },
] as const;

describe('Forecasting HTTP authorization', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const service = {
    products: jest.fn().mockResolvedValue({ products: [] }),
    latest: jest.fn().mockResolvedValue({ run: null }),
    run: jest.fn().mockResolvedValue({ run: { id: 'run-1' } }),
  };
  const send = (
    route: (typeof routes)[number],
    token: string | null = 'valid',
  ) => {
    const req = request(app.getHttpServer() as Server)[route.method](
      `/forecasting/${route.path.replace(':id', 'run-1')}`,
    );
    if (token !== null) req.set('Cookie', `test_session=${token}`);
    return req;
  };
  const expectNoCalls = () => {
    for (const handler of Object.values(service))
      expect(handler).not.toHaveBeenCalled();
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ForecastingController],
      providers: [
        { provide: ForecastingService, useValue: service },
        { provide: SessionService, useValue: { validateSession } },
        { provide: PrismaService, useValue: { user: { findUnique } } },
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

  it('covers every endpoint with exactly one explicit policy and no public override', () => {
    const reflector = new Reflector();
    const proto = ForecastingController.prototype;
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
    expect(reflector.get(PATH_METADATA, ForecastingController)).toBe(
      'forecasting',
    );
    for (const key of [ROLES_KEY, REQUIRED_PERMISSIONS_KEY, IS_PUBLIC_KEY]) {
      expect(reflector.get(key, ForecastingController)).toBeUndefined();
    }
    for (const route of routes) {
      const handler = proto[route.handler];
      expect(reflector.get(PATH_METADATA, handler)).toBe(route.path);
      expect(reflector.get(METHOD_METADATA, handler)).toBe(
        RequestMethod.GET,
      );
      expect(reflector.get(ROLES_KEY, handler)).toEqual(
        undefined,
      );
      expect(reflector.get(REQUIRED_PERMISSIONS_KEY, handler)).toEqual(
        ['forecasting.view'],
      );
      expect(reflector.get(IS_PUBLIC_KEY, handler)).toBeUndefined();
    }
  });

  it.each(routes)(
    'denies missing and invalid sessions on $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      grants = ['forecasting.view'];
      await send(route, null).expect(401);
      await send(route, 'invalid').expect(401);
      expect(findUnique).not.toHaveBeenCalled();
      expectNoCalls();
    },
  );

  it.each(
    [Role.STAFF, Role.MANAGER, Role.ADMINISTRATOR].flatMap((role) =>
      [false, true].map((view) => ({ role, view })),
    ),
  )(
    '$role with forecasting.view=$view enforces forecast access',
    async ({ role, view }) => {
      principal.role = role;
      grants = view ? ['forecasting.view'] : [];
      for (const route of routes) {
        jest.clearAllMocks();
        const allowed = view;
        await send(route).expect(allowed ? 200 : 403);
        expect(service[route.handler]).toHaveBeenCalledTimes(allowed ? 1 : 0);
        if (!allowed) expectNoCalls();
        expect(findUnique).toHaveBeenCalledTimes(1);
      }
    },
  );

  it.each(routes.filter((route) => route.method === 'get'))(
    'does not accept unrelated grants and honors revocation on $path',
    async (route) => {
      grants = ['dashboard.view', 'forecasting.unknown'];
      await send(route).expect(403);
      expectNoCalls();
      grants = ['forecasting.view'];
      await send(route).expect(200);
      grants = [];
      await send(route).expect(403);
      expect(service[route.handler]).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves query and run id forwarding', async () => {
    grants = ['forecasting.view'];
    await request(app.getHttpServer() as Server)
      .get('/forecasting/latest?productId=product-1&runId=run-1')
      .set('Cookie', 'test_session=valid')
      .expect(200, { run: null });
    expect(service.latest).toHaveBeenCalledWith('product-1', 'run-1');
    await send(routes[2]).expect(200, { run: { id: 'run-1' } });
    expect(service.run).toHaveBeenCalledWith('run-1');
  });
  it('removes the configurable forecast settings endpoint', async () => {
    principal.role = Role.ADMINISTRATOR;
    await request(app.getHttpServer() as Server)
      .put('/forecasting/settings')
      .set('Cookie', 'test_session=valid')
      .send({ forecastDays: 1 })
      .expect(404);
  });
});
