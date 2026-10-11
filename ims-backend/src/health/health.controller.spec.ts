import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('load balancer readiness', () => {
  it('checks the shared database before declaring an instance ready', async () => {
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const transaction = jest.fn((callback: (tx: unknown) => unknown) =>
      callback({ $queryRaw: query }),
    );
    const controller = new HealthController({
      $transaction: transaction,
    } as unknown as PrismaService);
    expect(await controller.ready()).toEqual({
      status: 'ok',
      instance: expect.any(String) as string,
    });
    expect(query).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 1000,
      timeout: 2000,
    });
  });

  it('returns 503 without leaking database errors', async () => {
    const controller = new HealthController({
      $transaction: jest
        .fn()
        .mockRejectedValue(new Error('private database details')),
    } as unknown as PrismaService);
    await expect(controller.ready()).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(controller.ready()).rejects.toThrow('Service is not ready');
    expect(controller.live()).toEqual({ status: 'ok' });
  });
});
