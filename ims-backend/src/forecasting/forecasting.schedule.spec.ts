import { ForecastingService, scheduledStart } from './forecasting.service';
import { PrismaService } from '../prisma/prisma.service';

const transactionMock = <T>(tx: T) =>
  jest.fn((callback: (transaction: T) => Promise<unknown>) => callback(tx));

describe('forecast scheduler lifecycle', () => {
  const original = process.env.ENABLE_BACKGROUND_JOBS;
  afterEach(() => {
    if (original === undefined) delete process.env.ENABLE_BACKGROUND_JOBS;
    else process.env.ENABLE_BACKGROUND_JOBS = original;
    jest.useRealTimers();
  });

  it('does not query or schedule work when background jobs are disabled', () => {
    jest.useFakeTimers();
    process.env.ENABLE_BACKGROUND_JOBS = 'false';
    const service = new ForecastingService({} as PrismaService);
    const check = jest.spyOn(service, 'checkSchedule').mockResolvedValue();
    service.onModuleInit();
    jest.advanceTimersByTime(120000);
    expect(check).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    service.onModuleDestroy();
  });

  it('starts once and stops polling on shutdown', () => {
    jest.useFakeTimers();
    process.env.ENABLE_BACKGROUND_JOBS = 'true';
    const service = new ForecastingService({} as PrismaService);
    const check = jest.spyOn(service, 'checkSchedule').mockResolvedValue();
    service.onModuleInit();
    service.onModuleInit();
    expect(check).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(60000);
    expect(check).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    jest.advanceTimersByTime(60000);
    expect(check).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('saved forecast period schedule', () => {
  it('exposes run-creation errors and clears them after scheduler recovery', async () => {
    const prisma = {
      forecastSettings: { findUnique: jest.fn().mockResolvedValue({ forecastDays: 2 }) },
      forecastRun: {
        updateMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new ForecastingService(prisma as unknown as PrismaService);
    const generate = jest.spyOn(service, 'generate').mockRejectedValueOnce(
      new Error('violates check constraint "forecast_runs_seven_days"'),
    ).mockResolvedValue({ run: {} } as Awaited<ReturnType<ForecastingService['generate']>>);
    await service.checkSchedule();
    expect((await service.latest()).scheduleError).toContain('duration migration');
    await service.checkSchedule();
    expect(generate).toHaveBeenCalledTimes(2);
    expect((await service.latest()).scheduleError).toBeNull();
  });

  it('returns the latest worker failure even when no run is active', async () => {
    const failure = { id: 'failed', status: 'FAILED', error: 'Forecast timed out after 30 minutes.' };
    const prisma = {
      forecastSettings: { findUnique: jest.fn().mockResolvedValue(null) },
      forecastRun: {
        updateMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null)
          .mockResolvedValueOnce(failure).mockResolvedValueOnce(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const result = await new ForecastingService(prisma as unknown as PrismaService).latest();
    expect(result.lastFailedRun).toEqual(failure);
    expect(result.automaticRetryPending).toBe(true);
  });

  it('starts the first period today', () => {
    expect(scheduledStart('2026-09-01')).toBe('2026-09-01');
  });
  it('waits seven days and never overlaps the previous week', () => {
    const previous = new Date('2026-09-07T00:00:00Z');
    expect(scheduledStart('2026-09-07', previous)).toBeNull();
    expect(scheduledStart('2026-09-08', previous)).toBe('2026-09-08');
    expect(scheduledStart('2026-08-31', previous)).toBeNull();
  });
  it('resumes today without backfilling missed predictions', () => {
    expect(scheduledStart('2026-10-02', new Date('2026-09-07T00:00:00Z'))).toBe(
      '2026-10-02',
    );
  });
  it('reuses an already saved week without launching another worker', async () => {
    const saved = { id: 'saved', status: 'COMPLETED' };
    const create = jest.fn();
    const prisma = {
      forecastRun: {
        updateMany: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: transactionMock({
        $queryRaw: jest.fn(),
        forecastRun: {
          findFirst: jest.fn().mockResolvedValue(saved),
          create,
        },
      }),
    };
    const service = new ForecastingService(prisma as unknown as PrismaService);
    expect(await service.generate('2026-09-01')).toEqual({ run: saved });
    expect(create).not.toHaveBeenCalled();
  });
  it('loads the selected saved run and its material data', async () => {
    const findFirst = jest
      .fn<
        Promise<{ id: string; endDate: Date; series: never[] }>,
        [
          {
            where: { status?: unknown; id?: string };
            include?: { series?: unknown };
          },
        ]
      >()
      .mockResolvedValue({
        id: 'older',
        endDate: new Date('2026-09-07T00:00:00Z'),
        series: [],
      });
    const prisma = {
      forecastSettings: {
        findUnique: jest.fn().mockResolvedValue({ forecastDays: 30 }),
      },
      forecastRun: {
        updateMany: jest.fn(),
        findFirst,
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new ForecastingService(prisma as unknown as PrismaService);
    const result = await service.latest(undefined, 'older');
    expect(result.run?.id).toBe('older');
    expect(result.nextForecastPeriod.days).toBe(30);
    const selectedQuery = findFirst.mock.calls.find(
      ([query]) => query.where.id === 'older',
    )?.[0];
    expect(selectedQuery?.where).toEqual({ status: 'COMPLETED', id: 'older' });
    expect(selectedQuery?.include?.series).toBeDefined();
  });
});

describe('forecast duration settings', () => {
  it.each([0, 31, 1.5, NaN, '7', null])(
    'rejects invalid days %s before writing',
    async (days) => {
      const prisma = { $transaction: jest.fn() };
      const service = new ForecastingService(
        prisma as unknown as PrismaService,
      );
      await expect(service.saveSettings(days as number)).rejects.toThrow(
        'between 1 and 30',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    },
  );

  it.each([1, 30])(
    'snapshots %i saved days into the run and worker',
    async (forecastDays) => {
      const create = jest.fn(
        ({
          data,
        }: {
          data: { startDate: Date; endDate: Date; activeKey: string };
        }) => Promise.resolve({ id: 'new', ...data }),
      );
      const tx = {
        $queryRaw: jest.fn(),
        forecastSettings: {
          findUnique: jest.fn().mockResolvedValue({ forecastDays }),
        },
        forecastRun: { findFirst: jest.fn().mockResolvedValue(null), create },
      };
      const prisma = {
        forecastRun: {
          updateMany: jest.fn(),
          findUnique: jest.fn().mockResolvedValue(null),
        },
        $transaction: transactionMock(tx),
      };
      const service = new ForecastingService(
        prisma as unknown as PrismaService,
      );
      const execute = jest
        .spyOn(
          service as unknown as {
            execute: (id: string, date: string, days: number) => Promise<void>;
          },
          'execute',
        )
        .mockResolvedValue();
      const { run } = await service.generate('2026-01-29');
      expect(run.endDate).toEqual(
        new Date(Date.UTC(2026, 0, 29 + forecastDays - 1)),
      );
      expect(execute).toHaveBeenCalledWith('new', '2026-01-29', forecastDays);
    },
  );

  it('saves days durably and previews the period after the running forecast', async () => {
    let forecastDays = 7;
    const settings = {
      findUnique: jest.fn(() => Promise.resolve({ forecastDays })),
      upsert: jest.fn(({ update }: { update: { forecastDays: number } }) => {
        forecastDays = update.forecastDays;
        return Promise.resolve({ forecastDays });
      }),
    };
    const prisma = {
      forecastSettings: settings,
      forecastRun: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ endDate: new Date('2099-01-31T00:00:00Z') }),
      },
      $transaction: transactionMock({
        $queryRaw: jest.fn(),
        forecastSettings: settings,
      }),
    };
    const service = new ForecastingService(prisma as unknown as PrismaService);
    expect(await service.saveSettings(30)).toEqual({
      nextForecastPeriod: {
        days: 30,
        startDate: '2099-02-01',
        endDate: '2099-03-02',
      },
    });
    const restarted = new ForecastingService(
      prisma as unknown as PrismaService,
    );
    expect(await restarted.saveSettings(1)).toEqual({
      nextForecastPeriod: {
        days: 1,
        startDate: '2099-02-01',
        endDate: '2099-02-01',
      },
    });
  });

  it('waits for a variable-length saved period to end', () => {
    expect(
      scheduledStart('2026-09-30', new Date('2026-09-30T00:00:00Z')),
    ).toBeNull();
    expect(scheduledStart('2026-10-01', new Date('2026-09-30T00:00:00Z'))).toBe(
      '2026-10-01',
    );
  });
});
