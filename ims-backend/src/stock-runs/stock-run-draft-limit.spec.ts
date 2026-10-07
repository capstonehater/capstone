import 'reflect-metadata';
import { ConflictException } from '@nestjs/common';
import { StockRunStatus } from '@prisma/client';
import { StockRunsService } from './stock-runs.service';

describe('System-wide unfinished stock run limit', () => {
  function setup(
    existing: {
      id: string;
      name: string;
      reference: string;
      status: StockRunStatus;
      createdByUserId: string;
    } | null = null,
  ) {
    let draft = existing;
    const query = jest.fn().mockResolvedValue([{ locked: 1 }]);
    const findFirst = jest
      .fn()
      .mockImplementation(() => Promise.resolve(draft));
    const create = jest
      .fn()
      .mockImplementation(
        ({ data }: { data: { name: string; createdByUserId: string } }) => {
          draft = {
            id: 'new-draft',
            reference: 'ST-RUN-20261007-003',
            status: StockRunStatus.DRAFT,
            ...data,
          };
          return Promise.resolve(draft);
        },
      );
    const tx = { $queryRaw: query, stockRun: { findFirst, create } };
    let tail = Promise.resolve<unknown>(undefined);
    const transaction = jest.fn(
      (callback: (client: typeof tx) => Promise<unknown>) => {
        const result = tail.then(() => callback(tx));
        tail = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    );
    const service = Object.assign(Object.create(StockRunsService.prototype), {
      prisma: { $transaction: transaction },
    }) as StockRunsService;
    return {
      service,
      query,
      findFirst,
      create,
      clear: () => {
        draft = null;
      },
    };
  }
  const existing = {
    id: 'old-draft',
    reference: 'ST-RUN-20261007-001',
    name: 'Tuesday run',
    status: StockRunStatus.DRAFT,
    createdByUserId: 'other-user',
  };
  it('blocks creation even when the existing draft belongs to another user', async () => {
    const { service, create, findFirst, query } = setup(existing);
    await expect(
      service.createStockRun({ name: 'New run' }, 'cashier'),
    ).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith({
      where: { status: StockRunStatus.DRAFT },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, reference: true },
    });
    expect(query.mock.invocationCallOrder[0]).toBeLessThan(
      findFirst.mock.invocationCallOrder[0],
    );
    expect(query.mock.calls[0][0].join('')).toContain('stock-run-draft-limit');
  });
  it('identifies the unfinished draft in the conflict alert', async () => {
    const { service } = setup(existing);
    try {
      await service.createStockRun({ name: 'New run' }, 'cashier');
      throw new Error('Expected a conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      const response = (error as ConflictException).getResponse();
      expect(response).toEqual(
        expect.objectContaining({
          draftId: 'old-draft',
          message: expect.stringContaining('Tuesday run'),
        }),
      );
    }
  });
  it('allows another run after the existing draft is posted or deleted', async () => {
    const { service, clear, create } = setup(existing);
    clear();
    await service.createStockRun({ name: 'New run' }, 'cashier');
    expect(create).toHaveBeenCalledWith({
      data: { name: 'New run', notes: null, createdByUserId: 'cashier' },
    });
  });
  it('allows only one draft when different users create simultaneously', async () => {
    const { service, create } = setup();
    const results = await Promise.allSettled([
      service.createStockRun({ name: 'First' }, 'user-1'),
      service.createStockRun({ name: 'Second' }, 'user-2'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
