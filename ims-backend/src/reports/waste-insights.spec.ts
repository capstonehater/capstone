import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from '../orders/orders.service';

describe('waste insight materials', () => {
  it('separates mixed units and counts one waste event across multiple batches', async () => {
    const line = (id: string, unit: string, qty: number) => ({
      rawMaterialId: id,
      rawMaterial: { id, name: id, sku: id, unit: { code: unit } },
      quantityDelta: new Prisma.Decimal(-qty),
      totalCostDelta: new Prisma.Decimal(-10),
    });
    const service = new ReportsService(
      {
        inventoryTransaction: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'waste',
              reasonCode: 'EXPIRED',
              occurredAt: new Date(),
              actorUser: null,
              note: null,
              lines: [
                line('rice', 'g', 100),
                line('rice', 'g', 50),
                line('milk', 'ml', 250),
              ],
            },
          ]),
        },
      } as unknown as PrismaService,
      {} as InventoryService,
      {} as OrdersService,
    );
    const report = await service.getWasteSummary({ includeAllGroups: 'true' });
    expect(report.totals.quantity).toBeNull();
    expect(
      report.totals.quantitiesByUnit.map((group) => [
        group.unit,
        group.quantity.toString(),
      ]),
    ).toEqual([
      ['g', '150'],
      ['ml', '250'],
    ]);
    expect(
      report.byMaterial.find((material) => material.rawMaterialId === 'rice')
        ?.eventCount,
    ).toBe(1);
  });

  it('lists only materials for each reason, deduplicates them, and preserves totals', async () => {
    const record = (reasonCode: string, id: string, name: string) => ({
      id: reasonCode + id,
      reasonCode,
      occurredAt: new Date(),
      actorUser: null,
      note: null,
      lines: [
        {
          rawMaterialId: id,
          rawMaterial: { id, name, sku: id.toUpperCase(), unit: { code: 'g' } },
          quantityDelta: new Prisma.Decimal(-2),
          totalCostDelta: new Prisma.Decimal(-10),
        },
      ],
    });
    const service = new ReportsService(
      {
        inventoryTransaction: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              record('EXPIRED', 'rice', 'Rice'),
              record('EXPIRED', 'rice', 'Rice'),
              record('EXPIRED', 'milk', 'Milk'),
              record('SPOILAGE', 'beans', 'Beans'),
              record('SPOILAGE', 'rice', 'Rice'),
            ]),
        },
      } as unknown as PrismaService,
      {} as InventoryService,
      {} as OrdersService,
    );
    const report = await service.getWasteSummary({ includeAllGroups: 'true' });
    expect(
      report.byReason
        .find((row) => row.reasonCode === 'EXPIRED')
        ?.materials.map((material) => ({
          ...material,
          quantity: material.quantity.toString(),
          cost: material.cost.toString(),
        })),
    ).toEqual([
      {
        rawMaterialId: 'milk',
        name: 'Milk',
        sku: 'MILK',
        unitCode: 'g',
        quantity: '2',
        cost: '10',
        eventCount: 1,
      },
      {
        rawMaterialId: 'rice',
        name: 'Rice',
        sku: 'RICE',
        unitCode: 'g',
        quantity: '4',
        cost: '20',
        eventCount: 2,
      },
    ]);
    expect(
      report.byReason
        .find((row) => row.reasonCode === 'SPOILAGE')
        ?.materials.map((material) => ({
          name: material.name,
          quantity: material.quantity.toString(),
          cost: material.cost.toString(),
          events: material.eventCount,
        })),
    ).toEqual([
      { name: 'Beans', quantity: '2', cost: '10', events: 1 },
      { name: 'Rice', quantity: '2', cost: '10', events: 1 },
    ]);
    expect(report.totals.cost.toString()).toBe('50');
    expect(report.totals.quantity.toString()).toBe('10');
    expect(report.totals.eventCount).toBe(5);
  });

  it('queries waste only within the selected report dates', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ReportsService(
      { inventoryTransaction: { findMany } } as unknown as PrismaService,
      {} as InventoryService,
      {} as OrdersService,
    );
    const from = '2026-10-01T00:00:00+08:00';
    const to = '2026-10-08T23:59:59.999+08:00';
    const report = await service.getWasteSummary({
      from,
      to,
      includeAllGroups: 'true',
    });
    expect(findMany.mock.calls[0][0].where.occurredAt).toEqual({
      gte: new Date(from),
      lte: new Date(to),
    });
    expect(report.period).toEqual({ from, to });
    expect(report.totals.cost.toString()).toBe('0');
  });
});
