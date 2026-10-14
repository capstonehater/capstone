import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { CatalogController } from '../catalog/catalog.controller';
import { CatalogService } from '../catalog/catalog.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { PermissionResolver } from '../auth/rbac/permission-resolver.service';
import { SessionService } from '../auth/session.service';
import { ReadCacheModule } from './read-cache.module';
import { ReadCacheService } from './read-cache.service';

describe('read cache HTTP authorization and invalidation', () => {
  let app: INestApplication;
  let active = true;
  let allowed = true;
  let products = [{ id: 'p1', name: 'Before' }];
  const listProducts = jest.fn(() => Promise.resolve(products));
  const getPosMenu = jest.fn(() => Promise.resolve({ products }));
  const validateSession = jest.fn(() =>
    Promise.resolve(
      active
        ? {
            id: 'u1',
            email: 'test@example.invalid',
            role: Role.STAFF,
            name: 'Test',
            isActive: true,
            sessionId: 's1',
          }
        : null,
    ),
  );
  const resolve = jest.fn(() =>
    Promise.resolve(
      new Set(allowed ? ['products.view', 'products.create', 'pos.view'] : []),
    ),
  );

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ReadCacheModule],
      controllers: [CatalogController],
      providers: [
        {
          provide: CatalogService,
          useValue: {
            listProducts,
            getPosMenu,
            createCategory: () => {
              products = [{ id: 'p1', name: 'After' }];
              return { id: 'c1' };
            },
          },
        },
        { provide: SessionService, useValue: { validateSession } },
        { provide: PermissionResolver, useValue: { resolve } },
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    app.get(ReadCacheService).invalidate();
    active = true;
    allowed = true;
    products = [{ id: 'p1', name: 'Before' }];
    jest.clearAllMocks();
  });
  const get = (path: string) =>
    request(app.getHttpServer() as Server)
      .get(path)
      .set('Cookie', 'ims_session=valid');

  it('checks the session and current permissions even with a warm cache', async () => {
    await get('/products').expect(200);
    await get('/products').expect(200);
    expect(listProducts).toHaveBeenCalledTimes(1);
    expect(validateSession).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledTimes(2);
    allowed = false;
    await get('/products').expect(403);
    active = false;
    await get('/products').expect(401);
    await request(app.getHttpServer() as Server)
      .get('/products')
      .expect(401);
    expect(listProducts).toHaveBeenCalledTimes(1);
  });

  it('clears cached reads after a mutation in another controller handler', async () => {
    await get('/products').expect(200, {
      products: [{ id: 'p1', name: 'Before' }],
    });
    await request(app.getHttpServer() as Server)
      .post('/categories')
      .set('Cookie', 'ims_session=valid')
      .send({ name: 'New' })
      .expect(201);
    await get('/products').expect(200, {
      products: [{ id: 'p1', name: 'After' }],
    });
    expect(listProducts).toHaveBeenCalledTimes(2);
  });

  it('keeps live POS menu reads uncached', async () => {
    await get('/pos/menu').expect(200);
    products = [{ id: 'p1', name: 'Live change' }];
    await get('/pos/menu').expect(200, { products });
    expect(getPosMenu).toHaveBeenCalledTimes(2);
  });
});
