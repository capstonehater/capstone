import { OrderStatus, Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

describe('POS dashboard orders in the selected range', () => {
  const from = '2026-10-01T00:00:00+08:00';
  const to = '2026-10-10T23:59:59.999+08:00';

  function setup() {
    const orders = Array.from({ length: 65 }, (_, index) => ({
      id: `order-${index}`,
      completedAt: new Date(to),
      totalAmount: new Prisma.Decimal(100),
      items: [{ quantity: 2 }],
      payments: [{ method: 'CASH' }],
      createdBy: { firstName: 'Admin', lastName: 'User' },
    }));
    const findMany = jest.fn(async (args) =>
      args.take ? orders.slice(0, args.take) : orders,
    );
    const service = Object.create(ReportsService.prototype);
    Object.assign(service, {
      prisma: {
        order: { findMany },
        orderItem: { groupBy: jest.fn().mockResolvedValue([]) },
      },
      ordersService: { getDisplayOrderNumber: (id: string) => id },
      salesQueries: {
        hourlySales: jest.fn().mockResolvedValue([]),
        productSales: jest.fn().mockResolvedValue([]),
      },
      aggregateOrderSummary: jest
        .fn()
        .mockResolvedValue({ netSales: new Prisma.Decimal(6500) }),
    });
    return { service: service as ReportsService, findMany, orders };
  }

  it('returns every matching order, including more than the usual 50-row maximum', async () => {
    const { service, findMany, orders } = setup();
    const report = await service.getPosDashboard({
      from,
      to,
      includeAllOrders: 'true',
    });
    expect(report.recentOrders.map((order) => order.id)).toEqual(
      orders.map((order) => order.id),
    );
    const query = findMany.mock.calls[0][0];
    expect(query).not.toHaveProperty('take');
    expect(query.where).toEqual({
      status: OrderStatus.COMPLETED,
      completedAt: { gte: new Date(from), lte: new Date(to) },
    });
    expect(query.orderBy).toEqual([{ completedAt: 'desc' }, { id: 'desc' }]);
  });

  it('preserves limited results for callers requesting a small dashboard preview', async () => {
    const { service, findMany } = setup();
    const report = await service.getPosDashboard({ from, to, limit: 1 });
    expect(report.recentOrders).toHaveLength(1);
    expect(findMany.mock.calls[0][0].take).toBe(10);
  });
});
