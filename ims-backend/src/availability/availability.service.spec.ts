import { AvailabilityBlockingReason, Prisma } from '@prisma/client';
import { AvailabilityService } from './availability.service';
import { InventoryStateHistoryService } from './inventory-state-history.service';

describe('AvailabilityService', () => {
  it('excludes expired stock from usable quantity while preserving on-hand quantity', async () => {
    const service = new AvailabilityService(
      {} as never,
      {
        syncRawMaterialStockoutEvents: jest.fn(),
        recordVariantAvailabilityEvents: jest.fn(),
      } as never,
    );

    const snapshots = await service.computeRawMaterialSummarySnapshots(
      {
        rawMaterial: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'rm-1',
              name: 'Milk',
              isActive: true,
              reorderPoint: new Prisma.Decimal(10),
            },
          ]),
        },
        stockBatch: {
          findMany: jest.fn().mockResolvedValue([
            {
              rawMaterialId: 'rm-1',
              remainingQuantity: new Prisma.Decimal(5),
              expirationDate: new Date('2026-08-02T16:00:00.000Z'),
            },
            {
              rawMaterialId: 'rm-1',
              remainingQuantity: new Prisma.Decimal(3),
              expirationDate: new Date('2026-08-05T16:00:00.000Z'),
            },
          ]),
        },
      } as never,
      ['rm-1'],
      new Date('2026-08-03T10:00:00.000+08:00'),
    );

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      rawMaterialId: 'rm-1',
      activeBatchCount: 2,
      stockState: 'LOW_STOCK',
    });
    expect(snapshots[0].onHandQuantity.toString()).toBe('8');
    expect(snapshots[0].usableQuantity.toString()).toBe('3');
    expect(snapshots[0].nonExpiredQuantity.toString()).toBe('3');
    expect(snapshots[0].expiredQuantity.toString()).toBe('5');
    expect(snapshots[0].nearestExpiryDate?.toISOString()).toBe(
      '2026-08-05T16:00:00.000Z',
    );
  });

  it('does not create duplicate availability events when a rerun keeps the same sellability state', async () => {
    const historyService = new InventoryStateHistoryService();
    const tx = {
      variantAvailabilitySummary: {
        findMany: jest.fn().mockResolvedValue([
          {
            productVariantId: 'variant-1',
            isSellable: false,
            blockingReason: AvailabilityBlockingReason.INSUFFICIENT_STOCK,
          },
        ]),
        upsert: jest.fn().mockResolvedValue(undefined),
      },
      variantAvailabilityEvent: {
        createMany: jest.fn().mockResolvedValue(undefined),
      },
    };
    const service = new AvailabilityService({} as never, historyService);

    jest
      .spyOn(service, 'computeVariantAvailabilitySnapshots')
      .mockResolvedValue([
        {
          productVariantId: 'variant-1',
          productVariantName: 'Regular',
          productId: 'product-1',
          productName: 'House Latte',
          productEnabled: true,
          variantEnabled: true,
          recipeLineCount: 1,
          activeRecipeMaterialCount: 1,
          isInStock: false,
          isSellable: false,
          availableBaseQty: 0,
          blockingReason: AvailabilityBlockingReason.INSUFFICIENT_STOCK,
        },
      ]);

    await service.refreshVariantSummariesForVariantIds(
      tx as never,
      ['variant-1'],
      new Date('2026-08-03T12:00:00.000+08:00'),
    );

    expect(tx.variantAvailabilitySummary.upsert).toHaveBeenCalledTimes(1);
    expect(tx.variantAvailabilityEvent.createMany).not.toHaveBeenCalled();
  });
});
