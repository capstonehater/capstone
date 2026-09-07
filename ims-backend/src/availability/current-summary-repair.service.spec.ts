import { CurrentSummaryRepairService } from './current-summary-repair.service';

describe('CurrentSummaryRepairService', () => {
  const tx = {};
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  const availabilityService = {
    refreshRawMaterialSummaries: jest.fn(),
    refreshVariantSummariesForVariantIds: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    availabilityService.refreshRawMaterialSummaries.mockResolvedValue(
      undefined,
    );
    availabilityService.refreshVariantSummariesForVariantIds.mockResolvedValue(
      undefined,
    );
  });

  it('passes the same reference date to raw-material and variant repair refreshes', async () => {
    const service = new CurrentSummaryRepairService(
      prisma as never,
      availabilityService as never,
    );
    const referenceDate = new Date('2026-08-03T10:15:00.000+08:00');
    const plan = {
      referenceDate: referenceDate.toISOString(),
      rawMaterials: [
        {
          rawMaterialId: 'rm-1',
          rawMaterialName: 'Milk',
          reasons: ['MISSING_SUMMARY'],
          existingSummary: null,
          expectedSummary: {
            onHandQuantity: '0' as never,
            usableQuantity: '0' as never,
            activeBatchCount: 0,
            nearestExpiryDate: null,
          },
          totalRemainingQuantity: '0' as never,
          nonExpiredRemainingQuantity: '0' as never,
          expiredRemainingQuantity: '0' as never,
          predictedStockoutEventAction: 'NONE' as const,
        },
      ],
      variants: [
        {
          productVariantId: 'pv-1',
          productVariantName: 'Regular',
          productId: 'product-1',
          productName: 'Latte',
          reasons: ['MISSING_SUMMARY'],
          existingSummary: null,
          expectedSummary: {
            isInStock: false,
            isSellable: false,
            availableBaseQty: 0,
            blockingReason: 'NO_RECIPE' as never,
          },
          predictedAvailabilityEvent: false,
        },
      ],
    };

    await service.applyPlan(plan as never, referenceDate);

    expect(
      availabilityService.refreshRawMaterialSummaries,
    ).toHaveBeenCalledWith(tx, ['rm-1'], referenceDate);
    expect(
      availabilityService.refreshVariantSummariesForVariantIds,
    ).toHaveBeenCalledWith(tx, ['pv-1'], referenceDate);
  });

  it('returns without opening a transaction when no rows need repair', async () => {
    const service = new CurrentSummaryRepairService(
      prisma as never,
      availabilityService as never,
    );

    const result = await service.applyPlan({
      referenceDate: new Date('2026-08-03T00:00:00.000Z').toISOString(),
      rawMaterials: [],
      variants: [],
    });

    expect(result).toEqual({
      rawMaterialIds: [],
      variantIds: [],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
