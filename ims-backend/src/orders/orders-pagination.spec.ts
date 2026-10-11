import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

// Pagination uses mocked collaborators and must not load deployment secrets.
jest.mock('../config/env.validation', () => ({ env: {} }));

type OrderPage = {
  orders: { id: string; createdByUserId: string }[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
type FindOptions = {
  where: { createdByUserId?: string };
  skip: number;
  take: number;
  cursor?: { id: string };
};

describe('Order history pagination over HTTP', () => {
  let app: INestApplication;
  const rows = Array.from({ length: 47 }, (_, index) => ({
    id: String(47 - index).padStart(8, '0'),
    createdByUserId: index % 2 ? 'cashier-b' : 'cashier-a',
    items: [],
    payments: [],
  }));
  const matching = (where: { createdByUserId?: string }) =>
    rows.filter(
      (row) =>
        !where.createdByUserId || row.createdByUserId === where.createdByUserId,
    );
  const findMany = jest.fn(({ where, skip, take, cursor }: FindOptions) => {
    const records = matching(where);
    const start = cursor
      ? records.findIndex((row) => row.id === cursor.id) + skip
      : skip;
    return Promise.resolve(records.slice(start, start + take));
  });
  const count = jest.fn(({ where }: Pick<FindOptions, 'where'>) =>
    Promise.resolve(matching(where).length),
  );

  beforeAll(async () => {
    const service = new OrdersService(
      {
        order: { findMany, count },
        $transaction: (operations: Promise<unknown>[]) =>
          Promise.all(operations),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const module = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: service }],
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
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('loads 20 by default and reaches every transaction without duplicates', async () => {
    const pages: string[] = [];
    for (const page of [1, 2, 3]) {
      const response = await request(app.getHttpServer() as Server)
        .get(`/orders?page=${page}`)
        .expect(200);
      expect((response.body as OrderPage).pagination).toEqual({
        page,
        pageSize: 20,
        total: 47,
        totalPages: 3,
      });
      expect((response.body as OrderPage).orders).toHaveLength(
        page === 3 ? 7 : 20,
      );
      pages.push(
        ...(response.body as OrderPage).orders.map(
          (row: { id: string }) => row.id,
        ),
      );
    }
    expect(pages).toEqual(rows.map((row) => row.id));
    expect(new Set(pages).size).toBe(47);
    expect(findMany.mock.calls.every(([options]) => options.take === 20)).toBe(
      true,
    );
  });

  it('applies the cashier filter to both the count and returned page', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/orders?createdByUserId=cashier-a&pageSize=10&page=3')
      .expect(200);
    expect((response.body as OrderPage).pagination).toEqual({
      page: 3,
      pageSize: 10,
      total: 24,
      totalPages: 3,
    });
    expect((response.body as OrderPage).orders).toHaveLength(4);
    expect(
      (response.body as OrderPage).orders.every(
        (row: { createdByUserId: string }) =>
          row.createdByUserId === 'cashier-a',
      ),
    ).toBe(true);
  });

  it('moves to the next page with a cursor and skips only the cursor row', async () => {
    const first = await request(app.getHttpServer() as Server)
      .get('/orders')
      .expect(200);
    const cursor = (first.body as OrderPage).orders[19].id;
    const next = await request(app.getHttpServer() as Server)
      .get(`/orders?page=2&cursor=${cursor}`)
      .expect(200);
    expect(
      (next.body as OrderPage).orders.map((row: { id: string }) => row.id),
    ).toEqual(rows.slice(20, 40).map((row) => row.id));
    expect(findMany.mock.calls[1][0]).toMatchObject({
      skip: 1,
      take: 20,
      cursor: { id: cursor },
    });
    expect((next.body as OrderPage).pagination).toEqual({
      page: 2,
      pageSize: 20,
      total: 47,
      totalPages: 3,
    });
  });

  it('returns an empty page and zero count for an unmatched cashier', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/orders?createdByUserId=missing')
      .expect(200);
    expect((response.body as OrderPage).orders).toEqual([]);
    expect((response.body as OrderPage).pagination.totalPages).toBe(0);
  });

  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=abc',
    'page=1000001',
    'pageSize=0',
    'pageSize=101',
    'pageSize=2.5',
    'pageSize=abc',
  ])('rejects invalid pagination: %s', async (query) => {
    await request(app.getHttpServer() as Server)
      .get(`/orders?${query}`)
      .expect(400);
    expect(findMany).not.toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
  });
});
