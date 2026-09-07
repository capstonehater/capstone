import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type TxClient = Prisma.TransactionClient;

export type RequestedModifierSelection = {
  modifierId: string;
  quantity: number;
};

export type ValidatedModifierSelection = {
  modifierId: string;
  modifierName: string;
  modifierGroupId: string;
  quantity: number;
  unitPriceAdjustment: Prisma.Decimal;
  recipeAdjustments: Array<{
    rawMaterialId: string;
    quantityDelta: Prisma.Decimal;
  }>;
};

type VariantWithModifierConfig = Prisma.ProductVariantGetPayload<{
  select: {
    id: true;
    productId: true;
    product: {
      select: {
        productModifierGroups: {
          select: {
            minSelect: true;
            maxSelect: true;
            isRequired: true;
            allowQuantity: true;
            modifierGroupId: true;
            modifierGroup: {
              select: {
                id: true;
                modifiers: {
                  where: { isActive: true };
                  select: {
                    id: true;
                    name: true;
                    priceAdjustment: true;
                    recipeAdjustments: {
                      select: {
                        rawMaterialId: true;
                        quantityDelta: true;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

@Injectable()
export class ModifierValidationService {
  async validateSelections(
    tx: TxClient,
    productVariantId: string,
    requestedSelections: RequestedModifierSelection[],
  ): Promise<ValidatedModifierSelection[]> {
    const variant = await tx.productVariant.findUnique({
      where: { id: productVariantId },
      select: {
        id: true,
        productId: true,
        product: {
          select: {
            productModifierGroups: {
              select: {
                minSelect: true,
                maxSelect: true,
                isRequired: true,
                allowQuantity: true,
                modifierGroupId: true,
                modifierGroup: {
                  select: {
                    id: true,
                    modifiers: {
                      where: { isActive: true },
                      select: {
                        id: true,
                        name: true,
                        priceAdjustment: true,
                        recipeAdjustments: {
                          select: {
                            rawMaterialId: true,
                            quantityDelta: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    const requestedByModifierId = new Map<string, RequestedModifierSelection>();
    for (const selection of requestedSelections) {
      if (selection.quantity < 1) {
        throw new BadRequestException('Modifier quantity must be at least 1');
      }

      if (requestedByModifierId.has(selection.modifierId)) {
        throw new BadRequestException('Duplicate modifier selection detected');
      }

      requestedByModifierId.set(selection.modifierId, selection);
    }

    const validatedSelections: ValidatedModifierSelection[] = [];

    for (const group of variant.product.productModifierGroups) {
      const matchingSelections = group.modifierGroup.modifiers
        .filter((modifier) => requestedByModifierId.has(modifier.id))
        .map((modifier) => {
          const requested = requestedByModifierId.get(modifier.id)!;

          if (!group.allowQuantity && requested.quantity !== 1) {
            throw new BadRequestException(
              `Modifier ${modifier.name} does not support quantity`,
            );
          }

          return {
            modifierId: modifier.id,
            modifierName: modifier.name,
            modifierGroupId: group.modifierGroupId,
            quantity: requested.quantity,
            unitPriceAdjustment: modifier.priceAdjustment,
            recipeAdjustments: modifier.recipeAdjustments,
          };
        });

      if (group.isRequired && matchingSelections.length < group.minSelect) {
        throw new BadRequestException(
          `Modifier group ${group.modifierGroup.id} requires at least ${group.minSelect} selection(s)`,
        );
      }

      if (matchingSelections.length > group.maxSelect) {
        throw new BadRequestException(
          `Modifier group ${group.modifierGroup.id} allows at most ${group.maxSelect} selection(s)`,
        );
      }

      validatedSelections.push(...matchingSelections);
      for (const selection of matchingSelections) {
        requestedByModifierId.delete(selection.modifierId);
      }
    }

    if (requestedByModifierId.size > 0) {
      throw new BadRequestException(
        'One or more modifiers are not allowed for this product',
      );
    }

    return validatedSelections;
  }
}
