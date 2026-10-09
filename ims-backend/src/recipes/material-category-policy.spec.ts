import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMaterialsAllowedForCategory } from './material-category-policy';
import { RecipeResolverService } from './recipe-resolver.service';
import { ProductManagementService } from '../catalog/product-management.service';

const categoryId = 'breakfast';

describe('material category restrictions', () => {
  const tx = {
    rawMaterial: { findFirst: jest.fn(), findMany: jest.fn() },
    productVariant: { findUnique: jest.fn() },
    variantRecipeItem: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  beforeEach(() => {
    jest.clearAllMocks();
    tx.rawMaterial.findFirst.mockResolvedValue(null);
    tx.productVariant.findUnique.mockResolvedValue({
      id: 'variant', product: { id: 'product', categoryId, archivedAt: null },
      recipeItems: [{ rawMaterialId: 'bacon', quantity: new Prisma.Decimal(1) }],
    });
  });

  it('allows an ingredient explicitly assigned to the category', async () => {
    await expect(assertMaterialsAllowedForCategory(tx as never, categoryId, ['bacon'])).resolves.toBeUndefined();
    expect(tx.rawMaterial.findFirst).toHaveBeenCalledWith({
      where: { id: { in: ['bacon'] }, categories: { none: { id: categoryId } } },
      select: { name: true },
    });
  });
  it('rejects an unassigned ingredient with an actionable message', async () => {
    tx.rawMaterial.findFirst.mockResolvedValue({ name: 'Bacon' });
    await expect(assertMaterialsAllowedForCategory(tx as never, 'coffee', ['bacon'])).rejects.toThrow('Bacon is not assigned to this product category');
  });
  it('allows an empty recipe without looking up assignments', async () => {
    await assertMaterialsAllowedForCategory(tx as never, categoryId, []);
    expect(tx.rawMaterial.findFirst).not.toHaveBeenCalled();
  });
  it('rejects recipe replacement before deleting the existing recipe', async () => {
    tx.rawMaterial.findMany.mockResolvedValue([{ id: 'bacon', isActive: true }]);
    tx.rawMaterial.findFirst.mockResolvedValue({ name: 'Bacon' });
    const prisma = { ...tx, $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
    const service = new ProductManagementService(prisma as never, {} as never, {} as never);
    await expect(service.replaceVariantRecipe('variant', { items: [{ rawMaterialId: 'bacon', quantity: 1 }] } as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.variantRecipeItem.deleteMany).not.toHaveBeenCalled();
  });
  it('rejects checkout when the base recipe ingredient is disallowed', async () => {
    tx.rawMaterial.findFirst.mockResolvedValue({ name: 'Bacon' });
    await expect(new RecipeResolverService().resolveVariantRequirements(tx as never, 'variant', [], 1)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('checks ingredients added by selected modifiers at checkout', async () => {
    await new RecipeResolverService().resolveVariantRequirements(tx as never, 'variant', [{
      quantity: 1, recipeAdjustments: [{ rawMaterialId: 'milk', quantityDelta: new Prisma.Decimal(2) }],
    }] as never, 1);
    expect(tx.rawMaterial.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['bacon', 'milk'] }, categories: { none: { id: categoryId } } },
    }));
  });
});
