import { Prisma, PaymentMethod } from '@prisma/client';
import { ReportsService } from './reports.service';

function order(total: string, payments: Array<[PaymentMethod, string]>) {
  return { id: 'order', completedAt: new Date(), totalAmount: new Prisma.Decimal(total), createdBy: {},
    payments: payments.map(([method, amount], index) => ({ id: String(index), method, amount: new Prisma.Decimal(amount), reference: null })) };
}

describe('payment collections exclude change', () => {
  it('keeps the original sale and applies a later refund on its own date', async () => {
    const row = {
      ...order('1008', [[PaymentMethod.CASH, '1100']]),
      completedAt: new Date('2026-10-01T13:00:00+08:00'),
      reversal: { occurredAt: new Date('2026-10-02T14:00:00+08:00'), amount: new Prisma.Decimal(1008) },
    };
    const service = new ReportsService({ order: { findMany: jest.fn().mockResolvedValue([row]) } } as never, {} as never, {} as never);
    const sale = await service.getPosPaymentReports({ from: '2026-10-01T00:00:00+08:00', to: '2026-10-01T23:59:59.999+08:00' });
    const refund = await service.getPosPaymentReports({ from: '2026-10-02T00:00:00+08:00', to: '2026-10-02T23:59:59.999+08:00' });
    expect(sale.summary.totalCollected.toString()).toBe('1008');
    expect(refund.summary.totalCollected.toString()).toBe('-1008');
    expect(refund.summary.cashTotal.toString()).toBe('-1008');
    expect(refund.summary.completedTransactionCount).toBe(0);
  });

  it('lists only the four supported payment methods', async () => {
    const row = order('180', [[PaymentMethod.MAYA, '180']]);
    const service = new ReportsService({ order: { findMany: jest.fn().mockResolvedValue([row]) } } as never, {} as never, {} as never);
    const report = await service.getPosPaymentReports({});
    expect(report.breakdown.find(method => method.method === PaymentMethod.MAYA)?.amount.toString()).toBe('180');
    expect(report.breakdown.map(item => item.method)).toEqual(['CASH', 'CARD', 'GCASH', 'MAYA']);
  });

  it.each([
    ['cash with change', order('180', [[PaymentMethod.CASH, '200']]), '180', '0'],
    ['exact cash', order('180', [[PaymentMethod.CASH, '180']]), '180', '0'],
    ['split tender, cash first', order('180', [[PaymentMethod.CASH, '100'], [PaymentMethod.CARD, '100']]), '80', '100'],
    ['split tender, card first', order('180', [[PaymentMethod.CARD, '100'], [PaymentMethod.CASH, '100']]), '80', '100'],
    ['noncash overpayment', order('180', [[PaymentMethod.CARD, '200']]), '0', '180'],
  ])('%s reconciles with total collected', async (_label, row, cash, card) => {
    const service = new ReportsService({ order: { findMany: jest.fn().mockResolvedValue([row]) } } as never, {} as never, {} as never);
    const report = await service.getPosPaymentReports({});
    expect(report.summary.cashTotal.toString()).toBe(cash);
    expect(report.summary.cardTotal.toString()).toBe(card);
    expect(report.breakdown.reduce((sum, method) => sum.plus(method.amount), new Prisma.Decimal(0)).equals(report.summary.totalCollected)).toBe(true);
    expect(report.breakdown.every(method => method.amount.greaterThanOrEqualTo(0))).toBe(true);
  });
});
