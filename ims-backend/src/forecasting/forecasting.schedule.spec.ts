import { ForecastingService, scheduledStart } from './forecasting.service';
import { PrismaService } from '../prisma/prisma.service';

describe('weekly forecast schedule', () => {
  it('starts the first week today', () => {
    expect(scheduledStart('2026-09-01')).toBe('2026-09-01');
  });
  it('waits seven days and never overlaps the previous week', () => {
    const previous = new Date('2026-09-01T00:00:00Z');
    expect(scheduledStart('2026-09-07', previous)).toBeNull();
    expect(scheduledStart('2026-09-08', previous)).toBe('2026-09-08');
    expect(scheduledStart('2026-08-31', previous)).toBeNull();
  });
  it('resumes the current aligned week without backfilling missed predictions', () => {
    expect(scheduledStart('2026-10-02', new Date('2026-09-01T00:00:00Z'))).toBe('2026-09-29');
  });
  it('reuses an already saved week without launching another worker', async () => {
    const saved = { id: 'saved', status: 'COMPLETED' };
    const create = jest.fn();
    const prisma = { forecastRun: { updateMany: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback) => callback({ $queryRaw: jest.fn(), forecastRun: { findFirst: jest.fn().mockResolvedValue(saved), create } })) };
    const service = new ForecastingService(prisma as unknown as PrismaService);
    expect(await service.generate('2026-09-01')).toEqual({ run: saved });
    expect(create).not.toHaveBeenCalled();
  });
  it('loads the selected saved run and its material data', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'older' });
    const prisma = { forecastRun: { updateMany: jest.fn(), findFirst, findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ForecastingService(prisma as unknown as PrismaService);
    const result = await service.latest(undefined, 'older');
    expect(result.run?.id).toBe('older');
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'COMPLETED', id: 'older' }, include: expect.objectContaining({ series: expect.any(Object) }) }));
  });
});
