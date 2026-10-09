import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
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
import {
  RequirePermission,
  REQUIRED_PERMISSIONS_KEY,
} from '../auth/decorators/require-permission.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

// No real sessions, environment secrets, database, or business mutations in this suite.
jest.mock('../config/env.validation', () => ({
  env: { SESSION_COOKIE_NAME: 'test_session' },
}));
const routes = [
  {
    handler: 'getSalesOverview',
    path: '/reports/sales-overview',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getVariantMargin',
    path: '/reports/variant-margin',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getWasteSummary',
    path: '/reports/waste-summary',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getStockRunSpend',
    path: '/reports/stock-run-spend',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getInventoryHealth',
    path: '/reports/inventory-health',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getInventoryKpiSummary',
    path: '/reports/inventory-kpi-summary',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getInventoryAvailabilityRisk',
    path: '/reports/inventory-availability-risk',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosDashboard',
    path: '/reports/pos-dashboard',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosTransactionHistory',
    path: '/reports/pos-transaction-history',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosSalesAnalytics',
    path: '/reports/pos-sales-analytics',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosPaymentReports',
    path: '/reports/pos-payment-reports',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosRefundsVoids',
    path: '/reports/pos-refunds-voids',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosProductPerformance',
    path: '/reports/pos-product-performance',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosStaffPerformance',
    path: '/reports/pos-staff-performance',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosPeakHours',
    path: '/reports/pos-peak-hours',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosInventoryLinked',
    path: '/reports/pos-inventory-linked',
    method: 'get',
    permission: 'reports.view',
  },
  {
    handler: 'getPosAuditExceptions',
    path: '/reports/pos-audit-exceptions',
    method: 'get',
    permission: 'reports.view',
  },
] as const;
const serviceMethods = routes.map((route) => route.handler);
describe('Report endpoint authorization (real HTTP guards and resolver)', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const reportService = Object.fromEntries(
    serviceMethods.map((name) => [
      name,
      jest.fn().mockResolvedValue({ ok: true }),
    ]),
  );
  const allCalls = () =>
    Object.values(reportService).reduce(
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
      controllers: [ReportsController],
      providers: [
        { provide: ReportsService, useValue: reportService },
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
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
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

  it('covers every report handler and requires only reports.view without conflicting policies', () => {
    const reflector = new Reflector();
    const prototype = ReportsController.prototype as unknown as Record<
      string,
      (...args: never[]) => unknown
    >;
    expect(
      Object.getOwnPropertyNames(prototype)
        .filter((name) => name !== 'constructor' && !name.startsWith('authorize'))
        .sort(),
    ).toEqual(routes.map((route) => route.handler).sort());
    for (const route of routes) {
      const targets = [prototype[route.handler], ReportsController];
      expect(
        reflector.getAllAndOverride(REQUIRED_PERMISSIONS_KEY, targets),
      ).toEqual(['reports.view']);
      for (const target of targets) {
        expect(reflector.get(ROLES_KEY, target)).toBeUndefined();
        expect(reflector.get(IS_PUBLIC_KEY, target)).toBeUndefined();
      }
    }
  });
  it.each(routes)(
    'Administrator with reports.view can read $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      grants = ['reports.view'];
      const response = await send(route).expect(200);
      expect(response.body).toEqual({ report: { ok: true } });
      expect(reportService[route.handler]).toHaveBeenCalledTimes(1);
      expect(allCalls()).toBe(1);
    },
  );
  it.each(routes)(
    'custom Analyst with only reports.view can read $path',
    async (route) => {
      principal.role = Role.MANAGER;
      grants = ['reports.view'];
      await send(route).expect(200);
      expect(reportService[route.handler]).toHaveBeenCalledTimes(1);
    },
  );
  it.each(routes)(
    'missing grants deny $path before report execution',
    async (route) => {
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it.each(routes)('missing session returns 401 for $path', async (route) => {
    grants = ['reports.view'];
    await send(route, false).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(allCalls()).toBe(0);
  });
  it.each(routes)(
    'legacy Administrator cannot bypass missing grants on $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it.each(routes)(
    'dashboard/inventory/stock-run/POS grants do not imply reports access on $path',
    async (route) => {
      grants = [
        'dashboard.view',
        'inventory.view',
        'stockRuns.view',
        'pos.view',
      ];
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it.each(routes)(
    'unknown database report keys cannot authorize $path',
    async (route) => {
      grants = ['reports.superuser', 'reports.export'];
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it('rejects unknown permission metadata at declaration time', () => {
    expect(() =>
      RequirePermission('reports.superuser' as PermissionKey),
    ).toThrow();
  });
  it('includes separate report viewing and export permissions', () => {
    expect(
      PERMISSION_CATALOG.filter((item) => item.module === 'reports').map(
        (item) => item.key,
      ),
    ).toEqual(['reports.view', 'reports.export.excel', 'reports.export.pdf']);
  });
  it.each(['excel', 'pdf'])('requires report access and the matching %s export grant', async (format) => {
    const endpoint = `/reports/export-access/${format}`;
    const check = () => request(app.getHttpServer() as Server).get(endpoint).set('Cookie', 'test_session=valid');
    grants = ['reports.view'];
    await check().expect(403);
    grants = [`reports.export.${format}`];
    await check().expect(403);
    grants = ['reports.view', `reports.export.${format === 'excel' ? 'pdf' : 'excel'}`];
    await check().expect(403);
    grants = ['reports.view', `reports.export.${format}`];
    await check().expect(200, { allowed: true });
    grants = ['reports.view'];
    await check().expect(403);
  });
  it('revocation takes effect on the next request', async () => {
    grants = ['reports.view'];
    await send(routes[0]).expect(200);
    grants = [];
    await send(routes[0]).expect(403);
    expect(allCalls()).toBe(1);
  });
  it('invalid session returns 401 before resolving permissions', async () => {
    validateSession.mockResolvedValueOnce(null);
    grants = ['reports.view'];
    await send(routes[0]).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(allCalls()).toBe(0);
  });
  it('inactive database identity is denied despite a stale session', async () => {
    findUnique.mockResolvedValueOnce({
      isActive: false,
      accountStatus: AccountStatus.INACTIVE,
      accessRoles: [],
    });
    await send(routes[0]).expect(403);
    expect(allCalls()).toBe(0);
  });
  it('preserves date and limit query forwarding through DTO validation', async () => {
    grants = ['reports.view'];
    await send({
      method: 'get',
      path: '/reports/sales-overview?from=2026-09-01&to=2026-09-29&limit=5',
    }).expect(200);
    expect(reportService.getSalesOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-09-01',
        to: '2026-09-29',
        limit: 5,
      }),
    );
  });
  it.each([
    '/reports/sales-overview?from=invalid',
    '/reports/inventory-health?limit=51',
    '/reports/pos-transaction-history?pageSize=101',
    '/reports/pos-peak-hours?dayType=invalid',
  ])('preserves filter validation for %s', async (path) => {
    grants = ['reports.view'];
    await send({ method: 'get', path }).expect(400);
    expect(allCalls()).toBe(0);
  });
});
