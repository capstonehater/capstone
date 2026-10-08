import { Prisma, InventoryTransactionType } from '@prisma/client';
import { InventoryActionsService } from './inventory-actions.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { AvailabilityService } from '../availability/availability.service';
import { OutboxService } from '../events/outbox.service';

describe('expired inventory waste', () => {
  const findUnique = jest.fn();
  const update = jest.fn();
  const appendTransaction = jest.fn();
  const refreshRawMaterialSummaries = jest.fn();
  const refreshVariantSummariesForRawMaterialIds = jest.fn();
  const enqueue = jest.fn();
  const tx = {
    rawMaterial: { findUnique: jest.fn().mockResolvedValue({ id: 'rice' }) },
    stockBatch: { findUnique, update },
    inventoryTransaction: { findUnique: jest.fn().mockResolvedValue({ id: 'waste' }) },
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const service = new InventoryActionsService(
    { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) } as unknown as PrismaService,
    { appendTransaction } as unknown as InventoryLedgerService,
    { refreshRawMaterialSummaries, refreshVariantSummariesForRawMaterialIds } as unknown as AvailabilityService,
    { enqueue } as unknown as OutboxService,
  );
  const dto = { rawMaterialId: 'rice', batchId: 'batch', quantity: 11440, reasonCode: 'EXPIRED' };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-08T00:00:00+08:00'));
    jest.clearAllMocks();
    findUnique.mockResolvedValue({
      id: 'batch', rawMaterialId: 'rice',
      remainingQuantity: new Prisma.Decimal(11440),
      costPerUnit: new Prisma.Decimal('0.05'),
      expirationDate: new Date('2020-01-01'),
    });
    appendTransaction.mockResolvedValue({ id: 'waste' });
  });

  afterEach(() => jest.useRealTimers());

  it('disposes of expired stock and records its quantity, cost, and reason', async () => {
    await service.logWaste(dto, 'staff');
    expect(update.mock.calls[0][0].data.remainingQuantity.toString()).toBe('0');
    const entry = appendTransaction.mock.calls[0][1];
    expect(entry.type).toBe(InventoryTransactionType.WASTE);
    expect(entry.reasonCode).toBe('EXPIRED');
    expect(entry.lines[0].quantityDelta.toString()).toBe('-11440');
    expect(entry.lines[0].totalCostDelta.toString()).toBe('-572');
    expect(refreshRawMaterialSummaries).toHaveBeenCalledWith(tx, ['rice']);
    expect(refreshVariantSummariesForRawMaterialIds).toHaveBeenCalledWith(tx, ['rice']);
    expect(enqueue).toHaveBeenCalledWith(tx, expect.objectContaining({ eventType: 'inventory.waste-logged' }));
  });

  it('still rejects waste exceeding the remaining expired stock', async () => {
    await expect(service.logWaste({ ...dto, quantity: 11441 }, 'staff')).rejects.toThrow('Waste quantity exceeds remaining batch quantity');
    expect(update).not.toHaveBeenCalled();
    expect(appendTransaction).not.toHaveBeenCalled();
  });

  it('still rejects a batch belonging to another material', async () => {
    await expect(service.logWaste({ ...dto, rawMaterialId: 'other' }, 'staff')).rejects.toThrow('Stock batch not found for this raw material');
    expect(update).not.toHaveBeenCalled();
    expect(appendTransaction).not.toHaveBeenCalled();
  });

  it('rejects partial disposal of an expired batch', async () => {
    await expect(service.logWaste({ ...dto, quantity: 1 }, 'staff')).rejects.toThrow('full remaining quantity');
    expect(update).not.toHaveBeenCalled();
    expect(appendTransaction).not.toHaveBeenCalled();
  });

  it.each(['2026-10-08', '2026-10-09', null])('rejects the Expired reason when expiry is %s', async (date) => {
    const batch = await findUnique();
    findUnique.mockResolvedValue({ ...batch, expirationDate: date ? new Date(date) : null });
    await expect(service.logWaste(dto, 'staff')).rejects.toThrow(date ? 'not expired according to its stock-run expiration date (' + date + ')' : 'no stock-run expiration date');
    expect(update).not.toHaveBeenCalled();
    expect(appendTransaction).not.toHaveBeenCalled();
  });

  it('allows another reason and a partial quantity on an unexpired batch', async () => {
    const batch = await findUnique();
    findUnique.mockResolvedValue({ ...batch, expirationDate: new Date('2026-10-09') });
    await service.logWaste({ ...dto, quantity: 1, reasonCode: 'SPOILAGE' }, 'staff');
    expect(update.mock.calls[0][0].data.remainingQuantity.toString()).toBe('11439');
    expect(appendTransaction.mock.calls[0][1].reasonCode).toBe('SPOILAGE');
  });
});
