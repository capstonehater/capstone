import { StoreAvailabilityService } from './store-availability.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StoreAvailabilityService', () => {
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const createMany = jest.fn().mockResolvedValue({ count: 1 });
  const update = jest.fn().mockResolvedValue({});
  const findMany = jest.fn();
  const prisma = {
    rawMaterial: { findUnique: jest.fn() },
    supplier: { findMany: jest.fn() },
    storeAvailabilitySearch: {
      updateMany,
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    storeAvailabilityResult: { createMany, update, findMany },
    $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        storeAvailabilitySearch: { updateMany },
        storeAvailabilityResult: { createMany, update },
      }),
    ),
  };
  const service = new StoreAvailabilityService(
    prisma as unknown as PrismaService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
    findMany.mockResolvedValue([
      { id: 'result', payload: { store_name: 'Shop', price: 100 } },
    ]);
  });

  it('reuses a pending search without starting another worker', async () => {
    prisma.rawMaterial.findUnique.mockResolvedValue({
      id: 'material',
      name: 'Bacon',
    });
    prisma.storeAvailabilitySearch.findFirst.mockResolvedValue({
      id: 'existing',
      status: 'PENDING',
    });
    await expect(service.start('material')).resolves.toEqual({
      id: 'existing',
      status: 'PENDING',
    });
    expect(prisma.storeAvailabilitySearch.create).not.toHaveBeenCalled();
  });

  it('keeps an in-progress ranking instead of launching another search', async () => {
    prisma.rawMaterial.findUnique.mockResolvedValue({
      id: 'material',
      name: 'Bacon',
    });
    prisma.storeAvailabilitySearch.findFirst.mockResolvedValue({
      id: 'ranking',
      status: 'RANKING',
    });
    await expect(service.start('material')).resolves.toEqual({
      id: 'ranking',
      status: 'RANKING',
    });
    expect(prisma.storeAvailabilitySearch.create).not.toHaveBeenCalled();
  });

  it('commits evidence, reads it back for Qwen, then saves recommendations and completion', async () => {
    const internals = service as unknown as {
      runPython: (input: unknown) => Promise<unknown[]>;
      execute: (
        id: string,
        product: string,
        stores: unknown[],
      ) => Promise<void>;
    };
    const spy = jest
      .spyOn(internals, 'runPython')
      .mockResolvedValueOnce([{ store_name: 'Shop', price: 100 }])
      .mockResolvedValueOnce([
        { store_name: 'Shop', price: 100, recommendation: { rank: 1 } },
      ]);
    await internals.execute('search', 'Bacon', []);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { searchId: 'search', payload: { store_name: 'Shop', price: 100 } },
      ],
    });
    expect(spy).toHaveBeenNthCalledWith(1, {
      product: 'Bacon',
      stores: [],
      collect_only: true,
    });
    expect(spy).toHaveBeenNthCalledWith(2, {
      product: 'Bacon',
      persisted: true,
      results: [{ store_name: 'Shop', price: 100 }],
    });
    expect(createMany.mock.invocationCallOrder[0]).toBeLessThan(
      findMany.mock.invocationCallOrder[0],
    );
    expect(findMany.mock.invocationCallOrder[0]).toBeLessThan(
      spy.mock.invocationCallOrder[1],
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: 'result' },
      data: {
        payload: {
          store_name: 'Shop',
          price: 100,
          recommendation: { rank: 1 },
        },
      },
    });
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'search', status: 'RANKING' },
        data: expect.objectContaining({ status: 'COMPLETED' }) as unknown,
      }),
    );
    spy.mockRestore();
  });

  it('retains saved evidence when the recommendation worker fails', async () => {
    const internals = service as unknown as {
      runPython: (input: unknown) => Promise<unknown[]>;
      execute: (
        id: string,
        product: string,
        stores: unknown[],
      ) => Promise<void>;
    };
    const spy = jest
      .spyOn(internals, 'runPython')
      .mockResolvedValueOnce([{ store_name: 'Shop', price: 100 }])
      .mockRejectedValueOnce(new Error('Ranking failed'));
    await internals.execute('search', 'Bacon', []);
    expect(createMany).toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }) as unknown,
      }),
    );
    spy.mockRestore();
  });

  it('saves provider failures without marking the search completed or invoking Qwen', async () => {
    const internals = service as unknown as {
      runPython: (input: unknown) => Promise<unknown[]>;
      execute: (
        id: string,
        product: string,
        stores: unknown[],
      ) => Promise<void>;
    };
    const spy = jest
      .spyOn(internals, 'runPython')
      .mockResolvedValue([
        { store_name: 'Shop', status: 'ERROR', price: null },
      ]);
    await internals.execute('search', 'Bacon', []);
    expect(createMany).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(findMany).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }) as unknown,
      }),
    );
    spy.mockRestore();
  });

  it('does not rank a search that already timed out', async () => {
    const internals = service as unknown as {
      runPython: (input: unknown) => Promise<unknown[]>;
      execute: (
        id: string,
        product: string,
        stores: unknown[],
      ) => Promise<void>;
    };
    updateMany.mockResolvedValueOnce({ count: 0 });
    const spy = jest.spyOn(internals, 'runPython').mockResolvedValue([]);
    await internals.execute('search', 'Bacon', []);
    expect(findMany).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('persists failures so the modal can retry', async () => {
    const internals = service as unknown as {
      runPython: () => Promise<unknown[]>;
      execute: (
        id: string,
        product: string,
        stores: unknown[],
      ) => Promise<void>;
    };
    const spy = jest
      .spyOn(internals, 'runPython')
      .mockRejectedValue(new Error('worker failed'));
    await internals.execute('search', 'Bacon', []);
    expect(updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }) as unknown,
      }),
    );
    spy.mockRestore();
  });
});
