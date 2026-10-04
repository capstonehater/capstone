import { ForecastingService, scheduledStart } from './forecasting.service';
import { PrismaService } from '../prisma/prisma.service';

const transactionMock = <T>(tx: T) =>
  jest.fn((callback: (transaction: T) => Promise<unknown>) => callback(tx));

describe('saved forecast period schedule', () => {
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
    expect(result.nextForecastPeriod.days).toBe(7);
    const selectedQuery = findFirst.mock.calls.find(
      ([query]) => query.where.id === 'older',
    )?.[0];
    expect(selectedQuery?.where).toEqual({ status: 'COMPLETED', id: 'older' });
    expect(selectedQuery?.include?.series).toBeDefined();
  });
});

describe('fixed weekly forecast period', () => {
  it.each([1, 30])(
    'ignores legacy %i-day settings and generates seven days',
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
        new Date(Date.UTC(2026, 0, 29 + 7 - 1)),
      );
      expect(execute).toHaveBeenCalledWith('new', '2026-01-29', 7);
    },
  );

  it('waits for a variable-length saved period to end', () => {
    expect(
      scheduledStart('2026-09-30', new Date('2026-09-30T00:00:00Z')),
    ).toBeNull();
    expect(scheduledStart('2026-10-01', new Date('2026-09-30T00:00:00Z'))).toBe(
      '2026-10-01',
    );
  });
});
