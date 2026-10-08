import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';

describe('near expiry window', () => {
  afterEach(() => jest.useRealTimers());
  it.each([
    ['2026-10-07T16:00:00Z', '2026-10-08', '2026-12-08'],
    ['2026-12-31T04:00:00Z', '2026-12-31', '2027-02-28'],
  ])('uses Manila today and two calendar months for %s', async (now, from, to) => {
    jest.useFakeTimers().setSystemTime(new Date(now));
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ReportsService({ stockBatch: { findMany } } as unknown as PrismaService,
      { listInventorySummary: jest.fn().mockResolvedValue([]) } as unknown as InventoryService, {} as OrdersService);
    await service.getInventoryHealth({});
    const range = findMany.mock.calls[0][0].where.expirationDate;
    expect(range.gte.toISOString().slice(0, 10)).toBe(from);
    expect(range.lte.toISOString().slice(0, 10)).toBe(to);
  });
});
