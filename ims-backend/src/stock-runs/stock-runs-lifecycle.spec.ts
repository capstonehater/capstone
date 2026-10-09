import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, StockRunStatus } from '@prisma/client';
import { validate } from 'class-validator';
import { CreateStockRunItemDto } from './dto/create-stock-run-item.dto';
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
    reference: 'ST-RUN-20261006-001',
    name: 'Delivery',
    status: StockRunStatus.DRAFT as StockRunStatus,
    items: [item] as Array<
      typeof item | Awaited<ReturnType<StockRunsService['addStockRunItem']>>
    >,
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
    rawMaterial: { findUnique: jest.fn() },
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
    prisma.rawMaterial.findUnique.mockResolvedValue({ id: item.rawMaterialId, unit: { code: 'G' } });
  });
  it.each(['G', 'ML', ' ml '].flatMap(code => [250, 500, 1000, 2000, 3000].map(quantity => [code, quantity] as const)))('normalizes a PHP 120 per 1000 %s price and posts %i with the correct batch and ledger value', async (code, quantity) => {
    prisma.rawMaterial.findUnique.mockResolvedValue({ id: item.rawMaterialId, unit: { code } });
    await service.addStockRunItem(run.id, {
      rawMaterialId: item.rawMaterialId,
      quantity,
      costPerUnit: 120,
    });
    expect(stockRunItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: new Prisma.Decimal(quantity),
        costPerUnit: new Prisma.Decimal('0.12'),
      }) as unknown,
    });
    const normalizedItem = {
      ...item,
      quantity: new Prisma.Decimal(quantity),
      costPerUnit: new Prisma.Decimal('0.12'),
    };
    run.items = [normalizedItem];
    stockBatch.create.mockResolvedValue({
      id: 'batch-1', rawMaterialId: item.rawMaterialId,
      initialQuantity: normalizedItem.quantity, costPerUnit: normalizedItem.costPerUnit,
    });
    await service.postStockRun(run.id, 'actor');
    expect(stockBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ costPerUnit: new Prisma.Decimal('0.12') }) as unknown,
    });
    expect(stockRun.update).toHaveBeenCalledWith({
      where: { id: run.id },
      data: expect.objectContaining({ totalCost: new Prisma.Decimal(quantity * 0.12) }) as unknown,
    });
    expect(ledger.appendTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({
      lines: [expect.objectContaining({
        quantityDelta: new Prisma.Decimal(quantity),
        unitCostSnapshot: new Prisma.Decimal('0.12'),
        totalCostDelta: new Prisma.Decimal(quantity * 0.12),
      })],
    }));
  });
  it.each([3, 999.9999])('uses price per kg even below 1000 g (%s g)', async (quantity) => {
    await service.addStockRunItem(run.id, { rawMaterialId: item.rawMaterialId, quantity, costPerUnit: 5 });
    expect(stockRunItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ costPerUnit: new Prisma.Decimal('0.005') }) as unknown,
    });
  });
  it('honors an explicit price basis instead of the default kg basis', async () => {
    await service.addStockRunItem(run.id, { rawMaterialId: item.rawMaterialId, quantity: 1000, costPerUnit: 120, costQuantity: 1 });
    expect(stockRunItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ costPerUnit: new Prisma.Decimal(120) }) as unknown,
    });
  });
  it.each([
    ['G', 'G', 250, 75, '0.3'],
    ['ML', 'ML', 250, 75, '0.3'],
    ['G', 'KG', 1, 120, '0.12'],
    ['ML', 'L', 1, 120, '0.12'],
    ['KG', 'G', 250, 75, '300'],
    ['L', 'ML', 250, 75, '300'],
    ['PCS', 'PCS', 12, 120, '10'],
  ] as const)('saves an explicit price basis for %s inventory priced per %s', async (code, costUnitCode, costQuantity, costPerUnit, expectedCost) => {
    prisma.rawMaterial.findUnique.mockResolvedValue({ id: item.rawMaterialId, unit: { code } });
    await service.addStockRunItem(run.id, { rawMaterialId: item.rawMaterialId, quantity: 1000, costPerUnit, costQuantity, costUnitCode });
    expect(stockRunItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: new Prisma.Decimal(1000), costPerUnit: new Prisma.Decimal(expectedCost),
        purchaseCost: new Prisma.Decimal(costPerUnit), priceQuantity: new Prisma.Decimal(costQuantity), priceUnitCode: costUnitCode,
      }) as unknown,
    });
  });
  it('posts 1000 ml priced at PHP 75 per 250 ml as PHP 300, preserving 1000 ml of stock', async () => {
    prisma.rawMaterial.findUnique.mockResolvedValue({ id: item.rawMaterialId, unit: { code: 'ML' } });
    stockRunItem.create.mockImplementation(({ data }) => Promise.resolve({ ...item, ...data }));
    const added = await service.addStockRunItem(run.id, { rawMaterialId: item.rawMaterialId, quantity: 1000, costPerUnit: 75, costQuantity: 250, costUnitCode: 'ML' });
    run.items = [added];
    stockBatch.create.mockResolvedValue({ id: 'batch-1', rawMaterialId: item.rawMaterialId, initialQuantity: added.quantity, costPerUnit: added.costPerUnit });
    await service.postStockRun(run.id, 'actor');
    expect(stockBatch.create).toHaveBeenCalledWith({ data: expect.objectContaining({ initialQuantity: new Prisma.Decimal(1000), remainingQuantity: new Prisma.Decimal(1000), costPerUnit: new Prisma.Decimal('0.3') }) as unknown });
    expect(stockRun.update).toHaveBeenCalledWith({ where: { id: run.id }, data: expect.objectContaining({ totalCost: new Prisma.Decimal(300) }) as unknown });
    expect(ledger.appendTransaction).toHaveBeenCalledWith(tx, expect.objectContaining({ lines: [expect.objectContaining({ quantityDelta: new Prisma.Decimal(1000), unitCostSnapshot: new Prisma.Decimal('0.3'), totalCostDelta: new Prisma.Decimal(300) })] }));
  });
  it('rejects a volume price unit for a mass material', async () => {
    await expect(service.addStockRunItem(run.id, { rawMaterialId: item.rawMaterialId, quantity: 1000, costPerUnit: 75, costQuantity: 250, costUnitCode: 'ML' })).rejects.toBeInstanceOf(BadRequestException);
    expect(stockRunItem.create).not.toHaveBeenCalled();
  });
  it('requires a price quantity when an explicit price unit is provided', async () => {
    await expect(service.addStockRunItem(run.id, { rawMaterialId: item.rawMaterialId, quantity: 1000, costPerUnit: 75, costUnitCode: 'G' })).rejects.toBeInstanceOf(BadRequestException);
    expect(stockRunItem.create).not.toHaveBeenCalled();
  });
  it('retains fractional per-gram costs so bulk totals stay accurate to centavos', async () => {
    await service.addStockRunItem(run.id, { rawMaterialId: item.rawMaterialId, quantity: 75000, costPerUnit: 41.3333 });
    expect(stockRunItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ costPerUnit: new Prisma.Decimal('0.0413333') }) as unknown,
    });
    expect(new Prisma.Decimal('0.0413333').mul(75000).toDecimalPlaces(2)).toEqual(new Prisma.Decimal(3100));
  });
  it.each(['KG', 'L', 'PCS'])('keeps %s pricing per inventory unit above 1000', async (code) => {
    prisma.rawMaterial.findUnique.mockResolvedValue({ id: item.rawMaterialId, unit: { code } });
    await service.addStockRunItem(run.id, { rawMaterialId: item.rawMaterialId, quantity: 3000, costPerUnit: 120 });
    expect(stockRunItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ costPerUnit: new Prisma.Decimal(120) }) as unknown,
    });
  });
  it.each([0, -1000, Infinity, NaN])('rejects an invalid price quantity of %s at the API boundary', async (costQuantity) => {
    const dto = Object.assign(new CreateStockRunItemDto(), {
      rawMaterialId: item.rawMaterialId, quantity: 1000, costPerUnit: 120, costQuantity,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'costQuantity')).toBe(true);
  });
  it('numbers batches within the run while preserving their UUID links', async () => {
    run.items = [item, { ...item, id: 'item-2' }];
    await service.postStockRun(run.id, 'actor');
    expect(stockBatch.create.mock.calls.map(([input]) => input.data.reference)).toEqual([
      'ST-RUN-20261006-001-B01', 'ST-RUN-20261006-001-B02',
    ]);
    expect(stockBatch.create.mock.calls.map(([input]) => input.data.stockRunItemId)).toEqual(['item-1', 'item-2']);
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
