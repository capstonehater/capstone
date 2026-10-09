import { Prisma, PaymentMethod } from '@prisma/client';
import { ReportsService } from './reports.service';

function order(total: string, payments: Array<[PaymentMethod, string]>) {
  return { id: 'order', completedAt: new Date(), totalAmount: new Prisma.Decimal(total), createdBy: {},
    payments: payments.map(([method, amount], index) => ({ id: String(index), method, amount: new Prisma.Decimal(amount), reference: null })) };
}

describe('payment collections exclude change', () => {
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
