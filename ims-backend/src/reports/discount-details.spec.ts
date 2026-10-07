import 'reflect-metadata';
import { OrderStatus, Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';

const cashier = {
  id: 'cashier',
  email: 'cashier@example.com',
  firstName: 'Cash',
  lastName: 'Ier',
};
function setup(legacy = false) {
  const order = {
    id: 'order-1',
    status: OrderStatus.COMPLETED,
    completedAt: new Date('2026-10-07T04:00:00Z'),
    discountCode: 'Senior Citizen (20%)',
    discountRate: new Prisma.Decimal(0.2),
    discountAmount: new Prisma.Decimal(20),
    discountCustomerName: legacy ? null : 'Maria Santos',
    discountIdNumber: legacy ? null : 'SC-123',
    createdBy: cashier,
    subtotalAmount: new Prisma.Decimal(100),
    totalAmount: new Prisma.Decimal(80),
    taxAmount: new Prisma.Decimal(0),
  };
  const findMany = jest.fn().mockResolvedValue([order]);
  const service = Object.assign(Object.create(ReportsService.prototype), {
    prisma: {
      order: { findMany },
      orderReversal: { findMany: jest.fn().mockResolvedValue([]) },
    },
  }) as ReportsService;
  return { service, findMany };
}

describe('Discount identity in audit reports', () => {
  it('includes saved name and ID alongside the discount type and amount', async () => {
    const { service, findMany } = setup();
    const report = await service.getPosAuditExceptions({
      exceptionType: 'DISCOUNT',
    });
    expect(report.rows[0].discountDetails).toEqual(
      expect.objectContaining({
        discountCustomerName: 'Maria Santos',
        discountIdNumber: 'SC-123',
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          discountCustomerName: true,
          discountIdNumber: true,
        }),
      }),
    );
  });
  it.each(['maria', 'sc-123'])(
    'finds a discounted order by customer identity: %s',
    async (reasonSearch) => {
      const { service } = setup();
      const report = await service.getPosAuditExceptions({
        exceptionType: 'DISCOUNT',
        reasonSearch,
      });
      expect(report.pagination.total).toBe(1);
    },
  );
  it('keeps older discounted orders with no recorded identity', async () => {
    const { service } = setup(true);
    const report = await service.getPosAuditExceptions({
      exceptionType: 'DISCOUNT',
    });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].discountDetails?.discountCustomerName).toBeNull();
    expect(report.rows[0].discountDetails?.discountIdNumber).toBeNull();
  });
});
