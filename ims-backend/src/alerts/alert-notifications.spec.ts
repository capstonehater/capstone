import { AlertState, Prisma } from '@prisma/client';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Alert notification feed', () => {
  it.each(['0', '-1', '1'])(
    'uses the usable quantity %s to choose depleted or running low',
    async (quantity) => {
      const create = jest.fn().mockResolvedValue({});
      const service = new AlertsService({
        rawMaterial: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'dough',
              name: 'Fresh Pizza Dough 250g',
              isActive: true,
              reorderPoint: new Prisma.Decimal(5),
              summary: { usableQuantity: new Prisma.Decimal(quantity) },
              stockBatches: [],
            },
          ]),
        },
        alert: {
          findUnique: jest.fn().mockResolvedValue(null),
          findMany: jest.fn().mockResolvedValue([]),
          create,
        },
      } as unknown as PrismaService);
      await service.syncOperationalAlertsForRawMaterialIds(['dough']);
      expect(create.mock.calls[0][0].data.title).toBe(
        `Fresh Pizza Dough 250g is ${Number(quantity) <= 0 ? 'depleted' : 'running low'}`,
      );
      expect(create.mock.calls[0][0].data.severity).toBe(
        Number(quantity) <= 0 ? 'CRITICAL' : 'WARNING',
      );
    },
  );

  it('returns all unread notifications and counts unresolved alerts independently', async () => {
    const alerts = Array.from({ length: 205 }, (_, index) => ({
      id: String(index),
    }));
    const findMany = jest.fn().mockResolvedValue(alerts);
    const count = jest.fn().mockResolvedValue(250);
    const service = new AlertsService({
      alert: { findMany, count },
    } as unknown as PrismaService);
    expect(await service.getNotifications()).toEqual({
      alerts,
      pendingCount: 250,
    });
    expect(findMany.mock.calls[0][0].where).toEqual({
      state: AlertState.ACTIVE,
    });
    expect(findMany.mock.calls[0][0].take).toBeUndefined();
    expect(count).toHaveBeenCalledWith({
      where: { state: { not: AlertState.RESOLVED } },
    });
  });

  it('locates the linked alert regardless of retention or list filters', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new AlertsService({
      alert: { findMany },
    } as unknown as PrismaService);
    await service.listAlerts({
      id: 'linked-alert',
      state: AlertState.ACTIVE,
      search: 'other item',
    });
    expect(findMany.mock.calls[0][0].where).toEqual({ id: 'linked-alert' });
  });
});
