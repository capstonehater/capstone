import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { withHistoricalMaterial } from './material-history-snapshot';

describe('material lifecycle', () => {
  const material = {
    id: 'material-1', name: 'Milk', sku: 'RM-MILK', isActive: false,
    reorderPoint: new Prisma.Decimal(5),
    unit: { id: 'unit-1', name: 'Milliliter', code: 'ML', dimension: 'VOLUME', conversionFactor: new Prisma.Decimal(1) },
  };
  const tx = {
    rawMaterial: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    variantRecipeItem: { count: jest.fn() },
    modifierRecipeAdjustment: { count: jest.fn() },
    stockRunItem: { count: jest.fn(), updateMany: jest.fn() },
    stockBatch: { updateMany: jest.fn() },
    inventoryTransactionLine: { updateMany: jest.fn() },
    inventoryDailySnapshot: { updateMany: jest.fn() },
    storeAvailabilitySearch: { updateMany: jest.fn() },
    alert: { updateMany: jest.fn() },
    stockoutEvent: { updateMany: jest.fn() },
  };
  const prisma = { ...tx, $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) => callback(tx)) };
  const service = new InventoryService(prisma as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    tx.rawMaterial.findUnique.mockResolvedValue(material);
    tx.rawMaterial.update.mockResolvedValue({ ...material, isActive: true });
    tx.variantRecipeItem.count.mockResolvedValue(0);
    tx.modifierRecipeAdjustment.count.mockResolvedValue(0);
    tx.stockRunItem.count.mockResolvedValue(0);
    for (const model of [tx.stockRunItem, tx.stockBatch, tx.inventoryTransactionLine, tx.inventoryDailySnapshot, tx.storeAvailabilitySearch, tx.alert, tx.stockoutEvent]) {
      model.updateMany.mockResolvedValue({ count: 1 });
    }
  });

  it('restores archived materials to active inventory', async () => {
    await expect(service.unarchiveRawMaterial(material.id)).resolves.toMatchObject({ isActive: true });
    expect(tx.rawMaterial.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: true } }));
  });

  it('saves material identity in every historical record before deleting the material', async () => {
    await expect(service.deleteRawMaterial(material.id)).resolves.toEqual({ id: material.id, name: material.name });
    const snapshot = JSON.parse(JSON.stringify(material));
    for (const model of [tx.stockRunItem, tx.stockBatch, tx.inventoryTransactionLine, tx.inventoryDailySnapshot, tx.storeAvailabilitySearch, tx.alert, tx.stockoutEvent]) {
      expect(model.updateMany).toHaveBeenCalledWith({ where: { rawMaterialId: material.id }, data: { rawMaterialSnapshot: snapshot } });
      expect(model.updateMany.mock.invocationCallOrder[0]).toBeLessThan(tx.rawMaterial.delete.mock.invocationCallOrder[0]);
    }
    expect(tx.rawMaterial.delete).toHaveBeenCalledWith({ where: { id: material.id } });
  });

  it.each(['recipe', 'modifier', 'draft'])('blocks deletion while referenced by a %s', async (reference) => {
    const counter = reference === 'recipe' ? tx.variantRecipeItem : reference === 'modifier' ? tx.modifierRecipeAdjustment : tx.stockRunItem;
    counter.count.mockResolvedValue(1);
    await expect(service.deleteRawMaterial(material.id)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.rawMaterial.delete).not.toHaveBeenCalled();
    expect(tx.inventoryTransactionLine.updateMany).not.toHaveBeenCalled();
  });

  it('does not delete when historical snapshot persistence fails', async () => {
    tx.stockBatch.updateMany.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(service.deleteRawMaterial(material.id)).rejects.toThrow('Database unavailable');
    expect(tx.rawMaterial.delete).not.toHaveBeenCalled();
  });

  it('returns not found for a missing material', async () => {
    tx.rawMaterial.findUnique.mockResolvedValue(null);
    await expect(service.deleteRawMaterial('missing')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.unarchiveRawMaterial('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reads deleted material identity and decimal values from history', () => {
    const row = withHistoricalMaterial({ rawMaterialId: null, rawMaterial: null, rawMaterialSnapshot: JSON.parse(JSON.stringify(material)) });
    expect(row.rawMaterialId).toBe(material.id);
    expect(row.rawMaterial.name).toBe('Milk');
    expect(row.rawMaterial.unit.code).toBe('ML');
    expect(row.rawMaterial.reorderPoint.equals(5)).toBe(true);
    expect(row.rawMaterial.isActive).toBe(false);
  });

  it('reads current material values while it still exists', () => {
    const row = withHistoricalMaterial({ rawMaterialId: material.id, rawMaterial: material, rawMaterialSnapshot: null });
    expect(row.rawMaterial).toBe(material);
  });
});
