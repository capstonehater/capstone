import { AlertState } from '@prisma/client';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AlertsService retention', () => {
  const cutoff = new Date('2026-08-29T12:00:00Z');
  const findMany = jest.fn().mockResolvedValue([]);
  const service = new AlertsService({ alert: { findMany } } as unknown as PrismaService);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T12:00:00Z'));
    findMany.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it.each([
    [AlertState.ACKNOWLEDGED, 'acknowledgedAt'],
    [AlertState.DISMISSED, 'dismissedAt'],
    [AlertState.RESOLVED, 'resolvedAt'],
  ])('filters %s by its action timestamp, not a fresh trigger', async (state, field) => {
    await service.listAlerts({ state });
    expect(findMany.mock.calls[0][0].where).toEqual({ state, [field]: { gte: cutoff } });
  });

  it('applies retention to all handled states in the default list while keeping active alerts', async () => {
    await service.listAlerts();
    expect(findMany.mock.calls[0][0].where).toEqual({ OR: [
      { state: AlertState.ACTIVE },
      { state: AlertState.ACKNOWLEDGED, acknowledgedAt: { gte: cutoff } },
      { state: AlertState.DISMISSED, dismissedAt: { gte: cutoff } },
      { state: AlertState.RESOLVED, resolvedAt: { gte: cutoff } },
    ] });
  });
});
