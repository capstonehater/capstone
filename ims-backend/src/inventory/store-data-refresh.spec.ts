import {
  parseOptions,
  refreshStoreData,
} from '../../scripts/refresh-store-data';
import { PrismaService } from '../prisma/prisma.service';
import { StoreAvailabilityService } from './store-availability.service';

describe('store-data refresh tool', () => {
  const material = { id: 'material-a', name: 'Pasta', storeSearches: [] };
  const findMany = jest.fn();
  const findUnique = jest.fn();
  const start = jest.fn();
  const log = jest.fn();
  const sleep = jest.fn().mockResolvedValue(undefined);
  const prisma = {
    rawMaterial: { findMany },
    storeAvailabilitySearch: { findUnique },
  } as unknown as PrismaService;
  const service = { start } as unknown as Pick<
    StoreAvailabilityService,
    'start'
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([material]);
    start.mockResolvedValue({ id: 'search-a' });
    findUnique.mockResolvedValue({
      status: 'COMPLETED',
      error: null,
      _count: { results: 3 },
    });
  });

  it('defaults to help and rejects ambiguous selectors', () => {
    expect(parseOptions([]).mode).toBe('help');
    for (const args of [
      ['--all', '--material', 'id'],
      ['--material'],
      ['--dry-run'],
      ['--unknown'],
    ]) {
      expect(() => parseOptions(args)).toThrow();
    }
  });

  it('lists saved material data without starting a search', async () => {
    await refreshStoreData(
      prisma,
      service,
      parseOptions(['--list']),
      log,
      sleep,
    );
    expect(start).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, storeSearches: { some: {} } },
      }),
    );
  });

  it('dry-runs one material without writing or calling providers', async () => {
    await refreshStoreData(
      prisma,
      service,
      parseOptions(['--material', 'material-a', '--dry-run']),
      log,
      sleep,
    );
    expect(start).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, id: 'material-a' } }),
    );
  });

  it('waits for persistence and ranking before refreshing the next material', async () => {
    findMany.mockResolvedValue([
      material,
      { ...material, id: 'material-b', name: 'Bacon' },
    ]);
    start
      .mockResolvedValueOnce({ id: 'search-a' })
      .mockResolvedValueOnce({ id: 'search-b' });
    findUnique.mockResolvedValueOnce({
      status: 'RANKING',
      _count: { results: 3 },
    });
    const result = await refreshStoreData(
      prisma,
      service,
      parseOptions(['--all']),
      log,
      sleep,
    );
    expect(result).toEqual({ completed: 2, failed: 0 });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(start.mock.invocationCallOrder[1]).toBeGreaterThan(
      findUnique.mock.invocationCallOrder[1],
    );
    expect(findUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'search-a' } }),
    );
    expect(findUnique).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ where: { id: 'search-b' } }),
    );
  });

  it('reports failures and continues the remaining batch', async () => {
    findMany.mockResolvedValue([
      material,
      { ...material, id: 'material-b', name: 'Bacon' },
    ]);
    findUnique.mockResolvedValueOnce({
      status: 'FAILED',
      error: 'Provider failed',
      _count: { results: 2 },
    });
    expect(
      await refreshStoreData(
        prisma,
        service,
        parseOptions(['--all']),
        log,
        sleep,
      ),
    ).toEqual({ completed: 1, failed: 1 });
  });

  it('does not refresh an unknown or archived material', async () => {
    findMany.mockResolvedValue([]);
    await expect(
      refreshStoreData(
        prisma,
        service,
        parseOptions(['--material', 'missing']),
        log,
        sleep,
      ),
    ).rejects.toThrow('No active material');
    expect(start).not.toHaveBeenCalled();
  });
});
