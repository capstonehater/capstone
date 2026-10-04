import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { OrdersService } from './orders.service';

describe('Cash tender corrections', () => {
  const setup = (overrides = {}) => {
    const order = {
      id: 'order-1', createdByUserId: 'cashier', status: 'COMPLETED', totalAmount: new Prisma.Decimal(100),
      payments: [{ id: 'cash-1', method: 'CASH', amount: new Prisma.Decimal(200) }], ...overrides,
    };
    const update = jest.fn();
    const enqueue = jest.fn();
    const tx = { $queryRaw: jest.fn(), order: { findUnique: jest.fn().mockResolvedValue(order) }, orderPayment: { update } };
    const service = Object.assign(Object.create(OrdersService.prototype), {
      prisma: { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) },
      outboxService: { enqueue },
    }) as OrdersService;
    return { service, update, enqueue, tx };
  };
  it('corrects the existing cash payment and records the previous amount', async () => {
    const { service, update, enqueue, tx } = setup();
    await service.updateCashPayment('order-1', { amount: 500, expectedAmount: 200 }, 'cashier');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ where: { id: 'cash-1' }, data: { amount: new Prisma.Decimal(500) } });
    expect(enqueue).toHaveBeenCalledWith(tx, expect.objectContaining({ payload: expect.objectContaining({ previousAmount: '200', amount: '500' }) }));
  });
  it.each([
    ['another cashier', {}, 500, 200, 'other'],
    ['a refunded order', { status: 'REFUNDED' }, 500, 200, 'cashier'],
    ['insufficient cash', {}, 50, 200, 'cashier'],
    ['a stale payment', {}, 500, 150, 'cashier'],
    ['no cash payment', { payments: [] }, 500, 200, 'cashier'],
  ])('rejects %s without changing payment', async (_label, overrides, amount, expectedAmount, actor) => {
    const { service, update, enqueue } = setup(overrides);
    await expect(service.updateCashPayment('order-1', { amount, expectedAmount }, actor)).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('leaves other payment methods intact in a split payment', async () => {
    const { service, update } = setup({ payments: [
      { id: 'cash-1', method: 'CASH', amount: new Prisma.Decimal(50) },
      { id: 'wallet-1', method: 'GCASH', amount: new Prisma.Decimal(50) },
    ] });
    await service.updateCashPayment('order-1', { amount: 200, expectedAmount: 50 }, 'cashier');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].where.id).toBe('cash-1');
  });
});
