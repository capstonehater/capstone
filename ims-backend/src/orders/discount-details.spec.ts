import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { CheckoutDto } from './dto/checkout.dto';
import { validateDiscountDetails } from './discount-details';
import { OrdersService } from './orders.service';

const payload = (overrides: Partial<CheckoutDto> = {}): CheckoutDto => ({
  idempotencyKey: 'discount-test',
  items: [],
  payments: [],
  discountCode: 'Senior Citizen (20%)',
  discountRate: 0.2,
  discountCustomerName: ' Maria Santos ',
  discountIdNumber: ' SC-123 ',
  ...overrides,
});

describe('Discount ID validation', () => {
  it.each(['Senior Citizen (20%)', 'PWD (20%)'])(
    'trims and accepts required details for %s',
    (code) => {
      expect(validateDiscountDetails(payload({ discountCode: code }))).toEqual({
        discountCustomerName: 'Maria Santos',
        discountIdNumber: 'SC-123',
      });
    },
  );
  it.each([
    { discountCustomerName: undefined },
    { discountCustomerName: '  ' },
    { discountIdNumber: undefined },
    { discountIdNumber: '  ' },
    { discountRate: 0.1 },
  ])('rejects invalid discounted checkout %p', (overrides) => {
    expect(() => validateDiscountDetails(payload(overrides))).toThrow(
      BadRequestException,
    );
  });
  it('does not attach identity details to a non-discounted order', () => {
    expect(
      validateDiscountDetails(
        payload({
          discountCode: undefined,
          discountRate: 0,
          discountCustomerName: undefined,
          discountIdNumber: undefined,
        }),
      ),
    ).toEqual({ discountCustomerName: null, discountIdNumber: null });
    expect(() =>
      validateDiscountDetails(
        payload({ discountCode: undefined, discountRate: 0 }),
      ),
    ).toThrow(BadRequestException);
  });
  it('rejects missing details before entering a checkout transaction', async () => {
    const transaction = jest.fn();
    const service = Object.assign(Object.create(OrdersService.prototype), {
      prisma: {
        order: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: transaction,
      },
    }) as OrdersService;
    await expect(
      service.checkout(payload({ discountIdNumber: '' }), 'cashier'),
    ).rejects.toThrow(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });
  it('writes trimmed discount identity into the order snapshot', async () => {
    const stop = new Error('stop after order create');
    const create = jest.fn().mockRejectedValue(stop);
    const tx = { order: { create } };
    const service = Object.assign(Object.create(OrdersService.prototype), {
      prisma: {
        order: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: (callback: (client: typeof tx) => unknown) =>
          callback(tx),
      },
      prepareCheckoutItem: jest
        .fn()
        .mockResolvedValue({ lineSubtotal: new Prisma.Decimal(100) }),
      pricingService: {
        calculateOrderDiscount: () => new Prisma.Decimal(20),
        calculateIncludedTax: () => new Prisma.Decimal(0),
      },
    }) as OrdersService;
    await expect(
      service.checkout(
        payload({
          items: [{ productVariantId: 'variant', quantity: 1, modifiers: [] }],
          payments: [{ method: PaymentMethod.CASH, amount: 100 }],
        }),
        'cashier',
      ),
    ).rejects.toThrow(stop);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        discountCustomerName: 'Maria Santos',
        discountIdNumber: 'SC-123',
        discountCode: 'Senior Citizen (20%)',
      }),
    });
  });
});
