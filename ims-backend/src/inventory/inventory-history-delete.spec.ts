import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { OutboxService } from '../events/outbox.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryActionsService } from './inventory-actions.service';

describe('inventory history deletion', () => {
  const updateMany = jest.fn();
  const findUnique = jest.fn();
  const findMany = jest.fn();
  const prisma = {
    inventoryTransaction: { updateMany, findUnique, findMany },
    rawMaterial: {
      findUnique: jest.fn().mockResolvedValue({ id: 'material-1' }),
    },
    stockBatch: { findUnique: jest.fn().mockResolvedValue({ id: 'batch-1' }) },
  };
  // No stock or ledger mutation methods are available: history deletion must not need them.
  const service = new InventoryActionsService(
    prisma as unknown as PrismaService,
    {} as InventoryLedgerService,
    {} as AvailabilityService,
    {} as OutboxService,
  );
  beforeEach(() => jest.clearAllMocks());

  it('hides an entry and records who deleted it without removing stock movements', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await expect(
      service.deleteTransactionHistory('transaction-1', 'user-1'),
    ).resolves.toEqual({ id: 'transaction-1', deleted: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'transaction-1', historyDeletedAt: null },
      data: {
        historyDeletedAt: expect.any(Date),
        historyDeletedByUserId: 'user-1',
      },
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('accepts a repeated deletion without overwriting the original deletion actor', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue({ id: 'transaction-1' });
    await expect(
      service.deleteTransactionHistory('transaction-1', 'user-2'),
    ).resolves.toEqual({ id: 'transaction-1', deleted: true });
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany.mock.calls[0][0].where.historyDeletedAt).toBeNull();
  });

  it('returns not found for an unknown entry', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValue(null);
    await expect(
      service.deleteTransactionHistory('missing', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates failed writes instead of reporting deletion', async () => {
    const error = new Error('Database unavailable');
    updateMany.mockRejectedValue(error);
    await expect(
      service.deleteTransactionHistory('transaction-1', 'user-1'),
    ).rejects.toBe(error);
  });

  it('filters deleted entries in global, material, and batch history', async () => {
    findMany.mockResolvedValue([]);
    await service.listTransactions({ search: 'waste' });
    await service.listTransactionsForRawMaterial('material-1', {});
    await service.listTransactionsForBatch('batch-1', {});
    expect(findMany).toHaveBeenCalledTimes(3);
    for (const [query] of findMany.mock.calls) {
      expect(query.where.historyDeletedAt).toBeNull();
    }
    expect(findMany.mock.calls[1][0].where.lines.some.rawMaterialId).toBe(
      'material-1',
    );
    expect(findMany.mock.calls[2][0].where.lines.some.stockBatchId).toBe(
      'batch-1',
    );
  });
});
