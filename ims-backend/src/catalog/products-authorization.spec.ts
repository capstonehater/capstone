import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { AdminProductsController } from './admin-products.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductManagementService } from './product-management.service';
import { AvailabilityController } from '../availability/availability.controller';
import { AvailabilityService } from '../availability/availability.service';
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
    controller: AdminProductsController,
    handler: 'listProducts',
    method: 'get',
    path: '/admin/products',
    permission: 'products.view',
  },
  {
    controller: AdminProductsController,
    handler: 'getProduct',
    method: 'get',
    path: '/admin/products/product-1',
    permission: 'products.view',
  },
  {
    controller: AdminProductsController,
    handler: 'createProduct',
    method: 'post',
    path: '/admin/products',
    permission: 'products.create',
  },
  {
    controller: AdminProductsController,
    handler: 'updateProduct',
    method: 'patch',
    path: '/admin/products/product-1',
    permission: 'products.edit',
  },
  {
    controller: AdminProductsController,
    handler: 'setProductManualAvailability',
    method: 'patch',
    path: '/admin/products/product-1/manual-availability',
    permission: 'products.edit',
  },
  {
    controller: AdminProductsController,
    handler: 'archiveProduct',
    method: 'post',
    path: '/admin/products/product-1/archive',
    permission: 'products.archive',
  },
  {
    controller: AdminProductsController,
    handler: 'restoreProduct',
    method: 'post',
    path: '/admin/products/product-1/restore',
    permission: 'products.restore',
  },
  {
    controller: AdminProductsController,
    handler: 'getDeleteEligibility',
    method: 'get',
    path: '/admin/products/product-1/delete-eligibility',
    permission: 'products.view',
  },
  {
    controller: AdminProductsController,
    handler: 'deleteProduct',
    method: 'delete',
    path: '/admin/products/product-1',
    permission: 'products.delete',
  },
  {
    controller: AdminProductsController,
    handler: 'createVariant',
    method: 'post',
    path: '/admin/products/product-1/variants',
    permission: 'products.create',
  },
  {
    controller: AdminProductsController,
    handler: 'updateVariant',
    method: 'patch',
    path: '/admin/variants/product-1',
    permission: 'products.edit',
  },
  {
    controller: AdminProductsController,
    handler: 'setVariantManualAvailability',
    method: 'patch',
    path: '/admin/variants/product-1/manual-availability',
    permission: 'products.edit',
  },
  {
    controller: AdminProductsController,
    handler: 'deleteVariant',
    method: 'delete',
    path: '/admin/variants/product-1',
    permission: 'products.delete',
  },
  {
    controller: AdminProductsController,
    handler: 'getVariantRecipe',
    method: 'get',
    path: '/admin/variants/product-1/recipe',
    permission: 'products.view',
  },
  {
    controller: AdminProductsController,
    handler: 'replaceVariantRecipe',
    method: 'put',
    path: '/admin/variants/product-1/recipe',
    permission: 'products.edit',
  },
  {
    controller: AdminProductsController,
    handler: 'getProductIngredientUsage',
    method: 'get',
    path: '/admin/products/product-1/ingredient-usage',
    permission: 'products.view',
  },
  {
    controller: AdminProductsController,
    handler: 'getOrderIngredientUsage',
    method: 'get',
    path: '/admin/products/product-1/orders/order-1/ingredient-usage',
    permission: 'products.view',
  },
  {
    controller: CatalogController,
    handler: 'listProducts',
    method: 'get',
    path: '/products',
    permission: 'products.view',
  },
  {
    controller: CatalogController,
    handler: 'listProductVariants',
    method: 'get',
    path: '/products/product-1/variants',
    permission: 'products.view',
  },
] as const;
const serviceMethods = [
  'listAdminProducts',
  'getAdminProductDetail',
  'createProduct',
  'updateProduct',
  'setProductManualAvailability',
  'archiveProduct',
  'restoreProduct',
  'getProductDeleteEligibility',
  'deleteProduct',
  'createVariant',
  'updateVariant',
  'setVariantManualAvailability',
  'deleteVariant',
  'getVariantRecipe',
  'replaceVariantRecipe',
  'getProductIngredientUsage',
  'getOrderIngredientUsage',
];

describe('Product endpoint authorization (real HTTP guards and resolver)', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const productService = Object.fromEntries(
    serviceMethods.map((name) => [
      name,
      jest.fn().mockResolvedValue({ ok: true }),
    ]),
  );
  const catalogService = {
    listProducts: jest.fn().mockResolvedValue([]),
    listCategories: jest.fn().mockResolvedValue([]),
    listProductVariants: jest.fn().mockResolvedValue([]),
    getPosMenu: jest.fn().mockResolvedValue({ products: [] }),
  };
  const availabilityService = {
    getVariantAvailability: jest.fn().mockResolvedValue({ available: true }),
  };
  const allCalls = () =>
    [
      ...Object.values(productService),
      ...Object.values(catalogService),
      ...Object.values(availabilityService),
    ].reduce((sum, fn) => sum + fn.mock.calls.length, 0);
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
      controllers: [
        AdminProductsController,
        CatalogController,
        AvailabilityController,
      ],
      providers: [
        { provide: ProductManagementService, useValue: productService },
        { provide: CatalogService, useValue: catalogService },
        { provide: AvailabilityService, useValue: availabilityService },
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
  it('covers every product management controller handler', () => {
    const methods = Object.getOwnPropertyNames(
      AdminProductsController.prototype,
    ).filter((name) => name !== 'constructor');
    expect(methods.sort()).toEqual(
      routes
        .filter((route) => route.controller === AdminProductsController)
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
      grants = ['products.view'];
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it('legacy Administrator label cannot bypass missing product grants', async () => {
    principal.role = Role.ADMINISTRATOR;
    await send(routes[0]).expect(403);
    expect(allCalls()).toBe(0);
  });
  it('legacy Staff POS grants do not imply product management access', async () => {
    grants = ['pos.view', 'pos.checkout'];
    await send(routes[0]).expect(403);
    await send({ method: 'get', path: '/products' }).expect(403);
    expect(allCalls()).toBe(0);
  });
  it.each(['/categories', '/variants/variant-1/availability'])(
    'preserves authenticated operational read %s without product grants',
    async (path) => {
      grants = ['pos.view'];
      await send({ method: 'get', path }).expect(200);
      expect(findUnique).not.toHaveBeenCalled();
      expect(allCalls()).toBe(1);
      await send({ method: 'get', path }, false).expect(401);
    },
  );
  it('invalid or revoked session returns 401 before permissions', async () => {
    validateSession.mockResolvedValueOnce(null);
    grants = ['products.view'];
    await send(routes[0]).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('permission revocation takes effect on the next request', async () => {
    grants = ['products.view'];
    await send(routes[0]).expect(200);
    grants = [];
    await send(routes[0]).expect(403);
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
    grants = ['products.superuser'];
    await send({ method: 'patch', path: '/admin/products/product-1' }).expect(
      403,
    );
  });
  it('uses only the six existing product catalog keys', () => {
    const keys = new Set<PermissionKey>(
      routes.map((route) => route.permission),
    );
    expect([...keys].sort()).toEqual(
      PERMISSION_CATALOG.filter((item) => item.module === 'products')
        .map((item) => item.key)
        .sort(),
    );
  });
});
