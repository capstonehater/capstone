import { OrdersService } from './orders.service';

describe('Report transaction Order ID search', () => {
  it.each(['O', 'OR', 'ORD', 'ORD-', ' ord- '])('matches every order reference for prefix %s while keeping other filters', async (search) => {
    const count = jest.fn().mockResolvedValue(5);
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new OrdersService(
      { order: { count, findMany }, $transaction: (operations: Promise<unknown>[]) => Promise.all(operations) } as never,
      {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never,
    );
    await service.listOrdersPaginated({ search, status: 'COMPLETED', from: '2026-10-01', paymentMethod: 'CASH' }, { orderIdOrStaffName: true });
    const where = count.mock.calls[0][0].where;
    expect(where.OR).toBeUndefined();
    expect(where.status).toBe('COMPLETED');
    expect(where.completedAt.gte).toEqual(new Date('2026-10-01'));
    expect(where.payments).toEqual({ some: { method: 'CASH' } });
    expect(findMany.mock.calls[0][0].where).toEqual(where);
  });

  it.each(['ORD-ABC12345', 'Robert', 'Robert Garcia'])('searches order IDs and staff names for %s without searching notes or products', async (search) => {
    const count = jest.fn().mockResolvedValue(0);
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new OrdersService(
      { order: { count, findMany }, $transaction: (operations: Promise<unknown>[]) => Promise.all(operations) } as never,
      {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never,
    );
    await service.listOrdersPaginated({ search }, { orderIdOrStaffName: true });
    const where = count.mock.calls[0][0].where;
    expect(where.OR[0]).toEqual({ id: search.startsWith('ORD-')
      ? { startsWith: 'ABC12345', mode: 'insensitive' }
      : { contains: search, mode: 'insensitive' } });
    expect(where.OR[1]).toEqual({ createdBy: { firstName: { contains: search, mode: 'insensitive' } } });
    expect(where.OR[2]).toEqual({ createdBy: { lastName: { contains: search, mode: 'insensitive' } } });
    expect(where.OR).toHaveLength(search.includes(' ') ? 4 : 3);
    if (search.includes(' ')) expect(where.OR[3].AND).toHaveLength(2);
    expect(JSON.stringify(where.OR)).not.toMatch(/notes|items|email/);
    expect(findMany.mock.calls[0][0].where).toEqual(where);
  });

  it.each([
    ['ORD-ABC12345', { startsWith: 'ABC12345', mode: 'insensitive' }],
    ['abc12345-1111-4111-8111-111111111111', { contains: 'abc12345-1111-4111-8111-111111111111', mode: 'insensitive' }],
    ['Cashier name', { contains: 'Cashier name', mode: 'insensitive' }],
  ])('limits %s to order IDs in both count and page queries', async (search, idFilter) => {
    const count = jest.fn().mockResolvedValue(0);
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new OrdersService(
      { order: { count, findMany }, $transaction: (operations: Promise<unknown>[]) => Promise.all(operations) } as never,
      {} as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never, {} as never,
    );
    await service.listOrdersPaginated({ search: `  ${search}  ` }, { orderIdOnly: true });
    expect(count.mock.calls[0][0].where.OR).toEqual([{ id: idFilter }]);
    expect(findMany.mock.calls[0][0].where.OR).toEqual([{ id: idFilter }]);
  });
});
