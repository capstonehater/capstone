import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { OrderStatus } from '@prisma/client';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

describe('Refund-only completed-order reversals', () => {
  it('exposes refund but no completed-order void route', () => {
    const routes = Object.getOwnPropertyNames(OrdersController.prototype)
      .map((name) => Reflect.getMetadata(PATH_METADATA, OrdersController.prototype[name]));
    expect(routes).toContain('orders/:id/refund');
    expect(routes).not.toContain('orders/:id/void');
  });

  it('rejects a reclassified refunded order before restoring inventory again', async () => {
    const updateStock = jest.fn();
    const createReversal = jest.fn();
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue({ id: 'old-void', status: OrderStatus.REFUNDED, reversal: { type: 'REFUND' } }) },
      stockBatch: { update: updateStock },
      orderReversal: { create: createReversal },
    };
    const service = Object.assign(Object.create(OrdersService.prototype), {
      prisma: { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) },
      authService: { authorizePrivilegedApproval: jest.fn().mockResolvedValue({ id: 'admin' }) },
    }) as OrdersService;
    await expect(service.refundOrder('old-void', {
      approverEmail: 'admin@example.com', approverPassword: 'test', reasonCode: 'CUSTOMER_REFUND',
    }, 'staff')).rejects.toThrow('Only completed orders can be reversed');
    expect(updateStock).not.toHaveBeenCalled();
    expect(createReversal).not.toHaveBeenCalled();
  });
});
