import { Prisma } from '@prisma/client';
import { loadPosHistory } from './pos-history';

describe('complete trading days for forecast history', () => {
  it('preserves the recorded consumption unit rather than the current inventory unit', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          materialId: 'm',
          date: '2026-09-28',
          sourceUnit: 'g',
          quantity: new Prisma.Decimal(12),
        },
      ])
      .mockResolvedValueOnce([{ date: '2026-09-28' }]);
    const result = await loadPosHistory(
      { $queryRaw: query } as unknown as Prisma.TransactionClient,
      '2026-10-01',
      new Date('2026-09-29T07:00:00Z'),
    );
    expect(result.posHistory).toEqual([
      { materialId: 'm', date: '2026-09-28', sourceUnit: 'g', quantity: 12 },
    ]);
    expect(query.mock.calls[0][0].join('')).toContain('raw_material_snapshot');
  });
  it.each([
    ['2026-10-01', '2026-09-29T07:00:00Z', '2026-09-28T16:00:00Z'],
    ['2026-10-01', '2026-09-29T15:00:00Z', '2026-09-28T16:00:00Z'],
    ['2026-09-01', '2026-09-29T07:00:00Z', '2026-08-31T16:00:00Z'],
  ])(
    'caps %s at a complete Philippine day',
    async (start, snapshot, expected) => {
      const query = jest.fn().mockResolvedValue([]);
      await loadPosHistory(
        { $queryRaw: query } as unknown as Prisma.TransactionClient,
        start,
        new Date(snapshot),
      );
      for (const call of query.mock.calls) {
        expect((call[1] as Date).toISOString()).toBe(
          new Date(expected).toISOString(),
        );
      }
    },
  );
});
