import { Prisma } from '@prisma/client';
import { loadPosHistory } from './pos-history';

describe('complete trading days for forecast history', () => {
  it.each([
    ['2026-10-01', '2026-09-29T07:00:00Z', '2026-09-28T16:00:00Z'],
    ['2026-10-01', '2026-09-29T15:00:00Z', '2026-09-28T16:00:00Z'],
    ['2026-09-01', '2026-09-29T07:00:00Z', '2026-08-31T16:00:00Z'],
  ])('caps %s at a complete Philippine day', async (start, snapshot, expected) => {
    const query = jest.fn().mockResolvedValue([]);
    await loadPosHistory({ $queryRaw: query } as unknown as Prisma.TransactionClient, start, new Date(snapshot));
    for (const call of query.mock.calls) {
      expect((call[1] as Date).toISOString()).toBe(new Date(expected).toISOString());
    }
  });
});
