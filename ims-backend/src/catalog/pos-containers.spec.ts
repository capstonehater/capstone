import { Prisma } from '@prisma/client';
import { CatalogService } from './catalog.service';
import { isContainerCategory } from './container-category';
import { RecipeResolverService } from '../recipes/recipe-resolver.service';
import { FEFOAllocator } from '../inventory/fefo-allocator.service';
import { OrdersService } from '../orders/orders.service';

describe('containers in POS', () => {
  it.each(['Container', 'Containers', ' container ', 'CONTAINERS'])(
    'recognizes the packaging category %s', (name) => {
      expect(isContainerCategory(name)).toBe(true);
      expect(isContainerCategory('Coffee')).toBe(false);
    },
  );

  it('hides packaging categories and products while retaining food that uses containers', async () => {
    const food = { id: 'food', name: 'Coffee', parentId: null };
    const container = { id: 'container', name: 'Container', parentId: null };
    const product = (id: string, category: typeof food) => ({
      id, name: id, category, isEnabled: true, variants: [], productModifierGroups: [],
    });
    const prisma = {
      product: { findMany: jest.fn().mockResolvedValue([product('latte', food), product('cup', container)]) },
      category: { findMany: jest.fn().mockResolvedValue([food, container]) },
      rawMaterialInventorySummary: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const menu = await new CatalogService(prisma as never).getPosMenu();
    expect(menu.categories).toEqual([food]);
    expect(menu.products.map((item) => item.id)).toEqual(['latte']);
    // The admin catalog must continue to expose the inventory category.
    expect(await new CatalogService(prisma as never).listCategories()).toEqual([food, container]);
  });

  it('rejects standalone container checkout before consuming inventory', async () => {
    const tx = {
      productVariant: { findUnique: jest.fn().mockResolvedValue({
        product: { category: { name: 'Container' }, isEnabled: true }, isEnabled: true,
      }) },
    };
    const allocateAndConsume = jest.fn();
    const service = Object.assign(Object.create(OrdersService.prototype), {
      prisma: {
        order: { findUnique: jest.fn().mockResolvedValue(null) },
        $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
      },
      allocator: { allocateAndConsume },
    }) as OrdersService;
    await expect(service.checkout({
      idempotencyKey: 'container-sale',
      items: [{ productVariantId: 'cup', quantity: 1, modifiers: [] }],
      payments: [],
    }, 'staff')).rejects.toThrow('Containers cannot be sold as standalone POS items');
    expect(allocateAndConsume).not.toHaveBeenCalled();
  });

  it('resolves and deducts containers with food ingredients for every ordered serving', async () => {
    const tx = {
      productVariant: { findUnique: jest.fn().mockResolvedValue({
        id: 'latte', product: { categoryId: 'coffee' }, recipeItems: [
          { rawMaterialId: 'coffee', quantity: new Prisma.Decimal(10) },
          { rawMaterialId: 'cup', quantity: new Prisma.Decimal(1) },
        ],
      }) },
      rawMaterial: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([
        { id: 'coffee-batch', raw_material_id: 'coffee', remaining_quantity: new Prisma.Decimal(100), cost_per_unit: new Prisma.Decimal(1) },
        { id: 'cup-batch', raw_material_id: 'cup', remaining_quantity: new Prisma.Decimal(10), cost_per_unit: new Prisma.Decimal(2) },
      ]),
      stockBatch: { update: jest.fn().mockResolvedValue({}) },
    };
    const requirements = await new RecipeResolverService().resolveVariantRequirements(tx as never, 'latte', [], 3);
    expect(requirements.map((item) => [item.rawMaterialId, item.quantity.toNumber()])).toEqual([['coffee', 30], ['cup', 3]]);
    const allocations = await new FEFOAllocator({} as never).allocateAndConsume(tx as never, requirements);
    expect(allocations.find((item) => item.rawMaterialId === 'cup')?.quantity.toNumber()).toBe(3);
    expect(tx.stockBatch.update).toHaveBeenCalledWith({
      where: { id: 'cup-batch' }, data: { remainingQuantity: new Prisma.Decimal(7) },
    });
  });
});
