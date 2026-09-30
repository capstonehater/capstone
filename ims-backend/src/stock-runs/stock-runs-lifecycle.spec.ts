import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, StockRunStatus } from '@prisma/client';
import { StockRunsService } from './stock-runs.service';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { AvailabilityService } from '../availability/availability.service';
import { OutboxService } from '../events/outbox.service';

describe('Stock Run lifecycle protections retained during authorization migration', () => {
  const item = {
    id: 'item-1',
    rawMaterialId: 'material-1',
    supplierId: 'supplier-1',
    quantity: new Prisma.Decimal(3),
    costPerUnit: new Prisma.Decimal(5),
    expirationDate: null,
    receivedAt: null,
  };
  const run = {
    id: 'run-1',
    name: 'Delivery',
    status: StockRunStatus.DRAFT as StockRunStatus,
    items: [item],
  };
  const stockRun = {
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  };
  const stockBatch = { create: jest.fn() };
  const stockRunItem = {
    findFirst: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
  const tx = { stockRun, stockBatch, stockRunItem };
  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: (value: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const ledger = { appendTransaction: jest.fn() };
  const availability = {
    refreshRawMaterialSummaries: jest.fn(),
    refreshVariantSummariesForRawMaterialIds: jest.fn(),
  };
  const outbox = { enqueue: jest.fn() };
  const service = new StockRunsService(
    prisma as unknown as PrismaService,
    ledger as unknown as InventoryLedgerService,
    availability as unknown as AvailabilityService,
    outbox as unknown as OutboxService,
  );
  beforeEach(() => {
    jest.resetAllMocks();
    run.status = StockRunStatus.DRAFT;
    run.items = [item];
    prisma.$transaction.mockImplementation((fn) => fn(tx));
    stockRun.findUnique.mockImplementation(() => Promise.resolve({ ...run }));
    stockRun.update.mockImplementation(() => {
      run.status = StockRunStatus.POSTED;
      return Promise.resolve({ ...run });
    });
    stockBatch.create.mockResolvedValue({
      id: 'batch-1',
      rawMaterialId: item.rawMaterialId,
      initialQuantity: item.quantity,
      costPerUnit: item.costPerUnit,
    });
  });
  it('only drafts can be deleted', async () => {
    run.status = StockRunStatus.POSTED;
    await expect(service.deleteDraftStockRun(run.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(stockRun.delete).not.toHaveBeenCalled();
  });
  it('deletes a draft through the existing service', async () => {
    await service.deleteDraftStockRun(run.id);
    expect(stockRun.delete).toHaveBeenCalledWith({ where: { id: run.id } });
  });
  it('unknown draft deletion returns not found', async () => {
    stockRun.findUnique.mockResolvedValueOnce(null);
    await expect(service.deleteDraftStockRun('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(stockRun.delete).not.toHaveBeenCalled();
  });
  it('posted drafts cannot be edited or have items added/removed', async () => {
    run.status = StockRunStatus.POSTED;
    await expect(
      service.updateStockRun(run.id, { name: 'Changed' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.addStockRunItem(run.id, {
        rawMaterialId: 'material-1',
        quantity: 1,
        costPerUnit: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.deleteStockRunItem(run.id, item.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(stockRun.update).not.toHaveBeenCalled();
    expect(stockRunItem.create).not.toHaveBeenCalled();
    expect(stockRunItem.delete).not.toHaveBeenCalled();
  });
  it('empty posting creates no batches or ledger entry', async () => {
    run.items = [];
    await expect(service.postStockRun(run.id, 'actor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(stockBatch.create).not.toHaveBeenCalled();
    expect(ledger.appendTransaction).not.toHaveBeenCalled();
  });
  it('unknown posting creates no inventory', async () => {
    stockRun.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.postStockRun('missing', 'actor'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(stockBatch.create).not.toHaveBeenCalled();
  });
  it('posting preserves batches, supplier, costs, actor, ledger, refreshes and outbox; repeat posting is rejected', async () => {
    await service.postStockRun(run.id, 'actor');
    expect(stockBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        rawMaterialId: item.rawMaterialId,
        supplierId: item.supplierId,
        stockRunItemId: item.id,
        initialQuantity: item.quantity,
        remainingQuantity: item.quantity,
        costPerUnit: item.costPerUnit,
      }) as unknown,
    });
    expect(stockRun.update).toHaveBeenCalledWith({
      where: { id: run.id },
      data: expect.objectContaining({
        status: StockRunStatus.POSTED,
        totalCost: new Prisma.Decimal(15),
      }) as unknown,
    });
    expect(ledger.appendTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        sourceId: run.id,
        actorUserId: 'actor',
        lines: [
          expect.objectContaining({
            quantityDelta: item.quantity,
            totalCostDelta: new Prisma.Decimal(15),
          }),
        ],
      }),
    );
    expect(availability.refreshRawMaterialSummaries).toHaveBeenCalledWith(tx, [
      item.rawMaterialId,
    ]);
    expect(
      availability.refreshVariantSummariesForRawMaterialIds,
    ).toHaveBeenCalledWith(tx, [item.rawMaterialId]);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        eventType: 'stock-run.posted',
        aggregateId: run.id,
      }),
    );
    await expect(service.postStockRun(run.id, 'actor')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(stockBatch.create).toHaveBeenCalledTimes(1);
    expect(ledger.appendTransaction).toHaveBeenCalledTimes(1);
  });
  it('ledger failure prevents marking posted and sending the outbox event', async () => {
    ledger.appendTransaction.mockRejectedValueOnce(new Error('ledger failure'));
    await expect(service.postStockRun(run.id, 'actor')).rejects.toThrow(
      'ledger failure',
    );
    expect(stockRun.update).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
