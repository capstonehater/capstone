import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';

describe('inventory summary status filters', () => {
  const materials = [
    { id: 'active', name: 'Active material', isActive: true },
    { id: 'archived', name: 'Archived material', isActive: false },
  ].map((material) => ({
    ...material,
    sku: null,
    reorderPoint: new Prisma.Decimal(1),
    updatedAt: new Date('2026-10-07T00:00:00Z'),
    unit: { id: 'unit', name: 'Gram', code: 'g' },
    summary: null,
    stockBatches: [],
  }));
  const findMany = jest.fn();
  const service = new InventoryService({
    rawMaterial: { findMany },
  } as unknown as PrismaService);

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockImplementation(({ where }: { where: { isActive?: boolean } }) =>
      Promise.resolve(materials.filter((material) =>
        where.isActive === undefined || material.isActive === where.isActive,
      )),
    );
  });

  it('returns archived materials when the archived status is selected', async () => {
    const result = await service.listInventorySummary({ status: 'INACTIVE' });
    expect(result.map((item) => item.rawMaterialId)).toEqual(['archived']);
    expect(result[0].status).toBe('INACTIVE');
  });

  it('excludes archived materials by default', async () => {
    const result = await service.listInventorySummary({});
    expect(result.map((item) => item.rawMaterialId)).toEqual(['active']);
  });

  it('includes both active and archived materials when explicitly requested', async () => {
    const result = await service.listInventorySummary({ includeArchived: 'true' });
    expect(result.map((item) => item.rawMaterialId)).toEqual(['active', 'archived']);
  });

  it('keeps active stock status filters restricted to matching materials', async () => {
    const result = await service.listInventorySummary({ status: 'OUT_OF_STOCK' });
    expect(result.map((item) => item.rawMaterialId)).toEqual(['active']);
  });
});
