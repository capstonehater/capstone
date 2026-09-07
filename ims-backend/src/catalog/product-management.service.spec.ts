import { ConflictException, NotFoundException } from '@nestjs/common';
import { ProductManagementService } from './product-management.service';

describe('ProductManagementService delete policy repair', () => {
  const tx = {
    product: {
      create: jest.fn(),
      delete: jest.fn(),
    },
    productVariant: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    variantRecipeItem: {
      deleteMany: jest.fn(),
    },
    variantAvailabilitySummary: {
      deleteMany: jest.fn(),
    },
    productModifierGroup: {
      deleteMany: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    ),
    product: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    productVariant: {
      findUnique: jest.fn(),
    },
    orderItem: {
      count: jest.fn(),
    },
    inventoryTransactionLine: {
      count: jest.fn(),
    },
    variantAvailabilityEvent: {
      count: jest.fn(),
    },
    stockoutEvent: {
      count: jest.fn(),
    },
  };

  const availabilityService = {
    refreshVariantSummariesForVariantIds: jest.fn(),
  };

  const ordersService = {};

  function createService() {
    return new ProductManagementService(
      prisma as never,
      availabilityService as never,
      ordersService as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();

    tx.product.create.mockResolvedValue({ id: 'product-1' });
    tx.product.delete.mockResolvedValue(undefined);
    tx.productVariant.create.mockResolvedValue({ id: 'variant-1' });
    tx.productVariant.delete.mockResolvedValue(undefined);
    tx.productVariant.deleteMany.mockResolvedValue({ count: 1 });
    tx.variantRecipeItem.deleteMany.mockResolvedValue({ count: 0 });
    tx.variantAvailabilitySummary.deleteMany.mockResolvedValue({ count: 0 });
    tx.productModifierGroup.deleteMany.mockResolvedValue({ count: 0 });

    prisma.product.findUnique.mockResolvedValue({
      id: 'product-1',
      archivedAt: null,
      variants: [{ id: 'variant-1' }],
    });
    prisma.product.delete.mockResolvedValue(undefined);
    prisma.productVariant.findUnique.mockResolvedValue({
      id: 'variant-1',
      productId: 'product-1',
    });
    prisma.orderItem.count.mockResolvedValue(0);
    prisma.inventoryTransactionLine.count.mockResolvedValue(0);
    prisma.variantAvailabilityEvent.count.mockResolvedValue(0);
    prisma.stockoutEvent.count.mockResolvedValue(0);

    availabilityService.refreshVariantSummariesForVariantIds.mockResolvedValue(
      undefined,
    );
  });

  it('refreshes newly created product variant summaries inside the creation transaction', async () => {
    const service = createService();
    const callOrder: string[] = [];

    jest
      .spyOn(service as any, 'ensureCategoryExists')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'ensureVariantSkusAvailable')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'ensureProductNameAvailable')
      .mockImplementation(() => {
        callOrder.push('name-check');
        return Promise.resolve();
      });
    jest.spyOn(service, 'getAdminProductDetail').mockImplementation(() => {
      callOrder.push('detail');
      return Promise.resolve({ id: 'product-1' } as never);
    });
    availabilityService.refreshVariantSummariesForVariantIds.mockImplementation(
      () => {
        callOrder.push('refresh');
        return Promise.resolve();
      },
    );

    await service.createProduct(
      {
        categoryId: 'category-1',
        name: 'House Latte',
        initialVariants: [
          {
            name: 'Regular',
            sku: 'LATTE-REG',
            price: '150.00',
          },
        ],
      } as any,
      'actor-1',
    );

    expect(
      availabilityService.refreshVariantSummariesForVariantIds,
    ).toHaveBeenCalledWith(tx, ['variant-1']);
    expect(callOrder).toEqual(['name-check', 'refresh', 'detail']);
  });

  it('fails variant creation when summary refresh fails and does not continue to detail loading', async () => {
    const service = createService();

    jest
      .spyOn(service as any, 'ensureVariantSkusAvailable')
      .mockResolvedValue(undefined);
    jest
      .spyOn(service as any, 'ensureVariantNameAvailable')
      .mockResolvedValue(undefined);
    const detailSpy = jest
      .spyOn(service, 'getAdminProductDetail')
      .mockResolvedValue({ id: 'product-1' } as never);

    availabilityService.refreshVariantSummariesForVariantIds.mockRejectedValue(
      new Error('refresh failed'),
    );

    await expect(
      service.createVariant('product-1', {
        name: 'Iced',
        sku: 'LATTE-ICED',
        price: '160.00',
      } as any),
    ).rejects.toThrow('refresh failed');

    expect(
      availabilityService.refreshVariantSummariesForVariantIds,
    ).toHaveBeenCalledWith(tx, ['variant-1']);
    expect(detailSpy).not.toHaveBeenCalled();
  });

  it('keeps product delete eligibility true when availability history is the only history present', async () => {
    const service = createService();

    prisma.variantAvailabilityEvent.count.mockResolvedValue(4);

    await expect(
      service.getProductDeleteEligibility('product-1'),
    ).resolves.toEqual({
      eligible: true,
      blockingReasons: [],
    });
  });

  it('blocks product delete eligibility on order history and does not report availability history by itself', async () => {
    const service = createService();

    prisma.orderItem.count.mockResolvedValue(3);
    prisma.variantAvailabilityEvent.count.mockResolvedValue(7);

    await expect(
      service.getProductDeleteEligibility('product-1'),
    ).resolves.toEqual({
      eligible: false,
      blockingReasons: [
        {
          code: 'HAS_ORDER_HISTORY',
          message: 'Product variants are referenced by historical orders.',
          count: 3,
        },
      ],
    });
  });

  it('blocks product delete eligibility on ledger and stockout history together', async () => {
    const service = createService();

    prisma.inventoryTransactionLine.count.mockResolvedValue(2);
    prisma.variantAvailabilityEvent.count.mockResolvedValue(5);
    prisma.stockoutEvent.count.mockResolvedValue(1);

    await expect(
      service.getProductDeleteEligibility('product-1'),
    ).resolves.toEqual({
      eligible: false,
      blockingReasons: [
        {
          code: 'HAS_LEDGER_HISTORY',
          message:
            'Product variants are referenced by inventory ledger history.',
          count: 2,
        },
        {
          code: 'HAS_STOCKOUT_HISTORY',
          message:
            'Product variants are referenced by retained stockout history.',
          count: 1,
        },
      ],
    });
  });

  it('allows variant deletion when availability history is the only history present', async () => {
    const service = createService();

    prisma.variantAvailabilityEvent.count.mockResolvedValue(6);
    jest
      .spyOn(service, 'getAdminProductDetail')
      .mockResolvedValue({ id: 'product-1' } as never);

    await expect(service.deleteVariant('variant-1')).resolves.toEqual({
      id: 'product-1',
    });

    expect(tx.variantRecipeItem.deleteMany).toHaveBeenCalledWith({
      where: { productVariantId: 'variant-1' },
    });
    expect(tx.variantAvailabilitySummary.deleteMany).toHaveBeenCalledWith({
      where: { productVariantId: 'variant-1' },
    });
    expect(tx.productVariant.delete).toHaveBeenCalledWith({
      where: { id: 'variant-1' },
    });
  });

  it('blocks variant deletion on order history even when availability history also exists', async () => {
    const service = createService();

    prisma.orderItem.count.mockResolvedValue(1);
    prisma.variantAvailabilityEvent.count.mockResolvedValue(6);

    await expect(service.deleteVariant('variant-1')).rejects.toThrow(
      new ConflictException(
        'Variant cannot be deleted because it has order history',
      ),
    );
  });

  it('blocks variant deletion on ledger history', async () => {
    const service = createService();

    prisma.inventoryTransactionLine.count.mockResolvedValue(2);
    prisma.variantAvailabilityEvent.count.mockResolvedValue(3);

    await expect(service.deleteVariant('variant-1')).rejects.toThrow(
      new ConflictException(
        'Variant cannot be deleted because it has inventory ledger history',
      ),
    );
  });

  it('blocks variant deletion on stockout history', async () => {
    const service = createService();

    prisma.stockoutEvent.count.mockResolvedValue(1);
    prisma.variantAvailabilityEvent.count.mockResolvedValue(2);

    await expect(service.deleteVariant('variant-1')).rejects.toThrow(
      new ConflictException(
        'Variant cannot be deleted because it has stockout history',
      ),
    );
  });

  it('throws not found for unknown variant delete requests', async () => {
    const service = createService();

    prisma.productVariant.findUnique.mockResolvedValue(null);

    await expect(service.deleteVariant('missing-variant')).rejects.toThrow(
      new NotFoundException('Variant not found'),
    );
  });

  it('deletes a product whose variants only have availability history', async () => {
    const service = createService();

    prisma.product.findUnique
      .mockResolvedValueOnce({
        id: 'product-1',
        variants: [{ id: 'variant-1' }],
      })
      .mockResolvedValueOnce({
        id: 'product-1',
        variants: [{ id: 'variant-1' }],
      });
    prisma.variantAvailabilityEvent.count.mockResolvedValue(5);

    await expect(service.deleteProduct('product-1')).resolves.toEqual({
      deleted: true,
      productId: 'product-1',
    });

    expect(tx.variantRecipeItem.deleteMany).toHaveBeenCalledWith({
      where: { productVariantId: { in: ['variant-1'] } },
    });
    expect(tx.variantAvailabilitySummary.deleteMany).toHaveBeenCalledWith({
      where: { productVariantId: { in: ['variant-1'] } },
    });
    expect(tx.productVariant.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['variant-1'] } },
    });
    expect(tx.productModifierGroup.deleteMany).toHaveBeenCalledWith({
      where: { productId: 'product-1' },
    });
    expect(tx.product.delete).toHaveBeenCalledWith({
      where: { id: 'product-1' },
    });
  });

  it('blocks product deletion when order history exists', async () => {
    const service = createService();

    prisma.orderItem.count.mockResolvedValue(1);
    prisma.variantAvailabilityEvent.count.mockResolvedValue(3);

    await expect(service.deleteProduct('product-1')).rejects.toThrow(
      new ConflictException('Product is not eligible for permanent delete'),
    );
  });

  it('blocks product deletion when ledger history exists', async () => {
    const service = createService();

    prisma.inventoryTransactionLine.count.mockResolvedValue(1);
    prisma.variantAvailabilityEvent.count.mockResolvedValue(3);

    await expect(service.deleteProduct('product-1')).rejects.toThrow(
      new ConflictException('Product is not eligible for permanent delete'),
    );
  });
});
