import { BadRequestException } from '@nestjs/common';
import { AlertState } from '@prisma/client';
import { AlertsService } from './alerts.service';
import { PrismaService } from '../prisma/prisma.service';

describe('Resolved alert deletion', () => {
  const deleteMany = jest.fn();
  const transaction = jest.fn(async (action: (tx: unknown) => Promise<unknown>) => action({ alert: { deleteMany } }));
  const service = new AlertsService({ $transaction: transaction } as unknown as PrismaService);
  beforeEach(() => { jest.clearAllMocks(); });
  it('deletes only the selected resolved rows', async () => {
    deleteMany.mockResolvedValue({ count: 2 });
    await expect(service.deleteResolvedAlerts(['one', 'two'])).resolves.toEqual({ deletedCount: 2 });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['one', 'two'] }, state: AlertState.RESOLVED } });
  });
  it('rejects the transaction when any requested row is missing or unresolved', async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.deleteResolvedAlerts(['one', 'two'])).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([[], ['one', 'one'], Array.from({ length: 201 }, (_, i) => String(i))])('rejects invalid selection %j without a transaction', async (...ids: string[]) => {
    await expect(service.deleteResolvedAlerts(ids)).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
});
