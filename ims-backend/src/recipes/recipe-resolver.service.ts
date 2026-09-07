import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toDecimal } from '../common/utils/decimal.util';
import { ValidatedModifierSelection } from './modifier-validation.service';

type TxClient = Prisma.TransactionClient;

export type ResolvedMaterialRequirement = {
  rawMaterialId: string;
  quantity: Prisma.Decimal;
};

@Injectable()
export class RecipeResolverService {
  async resolveVariantRequirements(
    tx: TxClient,
    productVariantId: string,
    selectedModifiers: ValidatedModifierSelection[],
    orderQuantity: number,
  ): Promise<ResolvedMaterialRequirement[]> {
    const variant = await tx.productVariant.findUnique({
      where: { id: productVariantId },
      select: {
        id: true,
        recipeItems: {
          select: {
            rawMaterialId: true,
            quantity: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    const materialMap = new Map<string, Prisma.Decimal>();

    for (const recipeItem of variant.recipeItems) {
      materialMap.set(recipeItem.rawMaterialId, toDecimal(recipeItem.quantity));
    }

    for (const modifier of selectedModifiers) {
      for (const adjustment of modifier.recipeAdjustments) {
        const current =
          materialMap.get(adjustment.rawMaterialId) ?? new Prisma.Decimal(0);
        materialMap.set(
          adjustment.rawMaterialId,
          current.plus(adjustment.quantityDelta.mul(modifier.quantity)),
        );
      }
    }

    return [...materialMap.entries()]
      .filter(([, quantity]) => quantity.greaterThan(0))
      .map(([rawMaterialId, quantity]) => ({
        rawMaterialId,
        quantity: quantity.mul(orderQuantity),
      }));
  }

  async hasBaseRecipe(
    tx: TxClient,
    productVariantId: string,
  ): Promise<boolean> {
    const count = await tx.variantRecipeItem.count({
      where: {
        productVariantId,
      },
    });

    return count > 0;
  }
}
