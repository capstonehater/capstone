process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??=
  'postgresql://test:test@127.0.0.1:5432/ims_test_disabled?schema=public';
process.env.SESSION_TOKEN_SECRET ??= 'test-session-secret';
process.env.RESET_TOKEN_SECRET ??= 'test-reset-secret';
process.env.FRONTEND_ORIGIN ??= 'http://localhost:3000';
process.env.FRONTEND_APP_URL ??= 'http://localhost:3000';
process.env.SESSION_COOKIE_NAME ??= 'ims_session';

import { InventoryDailySnapshotService } from './inventory-daily-snapshot.service';

describe('InventoryDailySnapshotService startup gating', () => {
  const originalEnableBackgroundJobs = process.env.ENABLE_BACKGROUND_JOBS;

  const tx = {};
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    inventoryDailySnapshot: {
      count: jest.fn(),
      createMany: jest.fn(),
    },
  };
  const inventoryService = {
    listInventorySummary: jest.fn(),
  };
  const availabilityService = {
    findRawMaterialIdsWithExpiredStock: jest.fn(),
    refreshRawMaterialSummaries: jest.fn(),
    refreshVariantSummariesForRawMaterialIds: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    availabilityService.findRawMaterialIdsWithExpiredStock.mockResolvedValue(
      [],
    );
    availabilityService.refreshRawMaterialSummaries.mockResolvedValue(
      undefined,
    );
    availabilityService.refreshVariantSummariesForRawMaterialIds.mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();

    if (originalEnableBackgroundJobs === undefined) {
      delete process.env.ENABLE_BACKGROUND_JOBS;
    } else {
      process.env.ENABLE_BACKGROUND_JOBS = originalEnableBackgroundJobs;
    }
  });

  function createService() {
    return new InventoryDailySnapshotService(
      prisma as never,
      inventoryService as never,
      availabilityService as never,
    );
  }

  it('does not run or schedule startup work when background jobs are disabled', () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'false';
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const service = createService();
    const captureSpy = jest
      .spyOn(service, 'captureTodayIfMissing')
      .mockResolvedValue(undefined);

    service.onModuleInit();

    expect(captureSpy).not.toHaveBeenCalled();
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(prisma.inventoryDailySnapshot.count).not.toHaveBeenCalled();
    expect(
      availabilityService.findRawMaterialIdsWithExpiredStock,
    ).not.toHaveBeenCalled();
  });

  it('still allows explicit snapshot capture when startup jobs are disabled', async () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'false';
    const service = createService();
    prisma.inventoryDailySnapshot.count.mockResolvedValue(1);

    await service.captureTodayIfMissing();

    expect(prisma.inventoryDailySnapshot.count).toHaveBeenCalledTimes(1);
    expect(inventoryService.listInventorySummary).not.toHaveBeenCalled();
  });

  it('refreshes expiry-sensitive summaries before snapshot capture and only once per business date', async () => {
    const service = createService();
    prisma.inventoryDailySnapshot.count.mockResolvedValue(1);
    availabilityService.findRawMaterialIdsWithExpiredStock.mockResolvedValue([
      'rm-1',
      'rm-2',
    ]);

    await service.captureSnapshotIfMissing('2026-08-03');
    await service.captureSnapshotIfMissing('2026-08-03');

    expect(
      availabilityService.findRawMaterialIdsWithExpiredStock,
    ).toHaveBeenCalledTimes(1);
    expect(
      availabilityService.refreshRawMaterialSummaries,
    ).toHaveBeenCalledTimes(1);
    expect(
      availabilityService.refreshVariantSummariesForRawMaterialIds,
    ).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refreshes again on the next Manila business date', async () => {
    const service = createService();
    prisma.inventoryDailySnapshot.count.mockResolvedValue(1);
    availabilityService.findRawMaterialIdsWithExpiredStock.mockResolvedValue([
      'rm-1',
    ]);

    await service.captureSnapshotIfMissing('2026-08-03');
    await service.captureSnapshotIfMissing('2026-08-04');

    expect(
      availabilityService.findRawMaterialIdsWithExpiredStock,
    ).toHaveBeenCalledTimes(2);
    expect(
      availabilityService.refreshRawMaterialSummaries,
    ).toHaveBeenCalledTimes(2);
    expect(
      availabilityService.refreshVariantSummariesForRawMaterialIds,
    ).toHaveBeenCalledTimes(2);
  });

  it('runs immediately, schedules once, and clears the timer when enabled', () => {
    process.env.ENABLE_BACKGROUND_JOBS = 'true';
    jest.useFakeTimers();
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const service = createService();
    const captureSpy = jest
      .spyOn(service, 'captureTodayIfMissing')
      .mockResolvedValue(undefined);

    service.onModuleInit();
    service.onModuleInit();

    expect(captureSpy).toHaveBeenCalledTimes(1);
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);

    service.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(1);
  });
});
