import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    return this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async listProducts() {
    return this.prisma.product.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: [{ name: 'asc' }],
      include: {
        category: true,
      },
    });
  }

  async listProductVariants(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, archivedAt: null },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: [{ name: 'asc' }],
      include: {
        availabilitySummary: true,
      },
    });
  }

  async getPosMenu() {
    const products = await this.prisma.product.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: [{ name: 'asc' }],
      include: {
        category: true,
        variants: {
          orderBy: { name: 'asc' },
          include: {
            availabilitySummary: true,
          },
        },
        productModifierGroups: {
          orderBy: { sortOrder: 'asc' },
          include: {
            modifierGroup: {
              include: {
                modifiers: {
                  where: { isActive: true },
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    recipeAdjustments: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const categories = await this.listCategories();
    const rawMaterialIds = [
      ...new Set(
        products.flatMap((product) =>
          product.productModifierGroups.flatMap((group) =>
            group.modifierGroup.modifiers.flatMap((modifier) =>
              modifier.recipeAdjustments.map(
                (adjustment) => adjustment.rawMaterialId,
              ),
            ),
          ),
        ),
      ),
    ];

    const materialSummaries =
      await this.prisma.rawMaterialInventorySummary.findMany({
        where: {
          rawMaterialId: { in: rawMaterialIds },
        },
        select: {
          rawMaterialId: true,
          usableQuantity: true,
        },
      });

    const usableByRawMaterialId = new Map(
      materialSummaries.map((summary) => [
        summary.rawMaterialId,
        summary.usableQuantity,
      ]),
    );

    return {
      categories,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        isEnabled: product.isEnabled,
        category: {
          id: product.category.id,
          name: product.category.name,
          parentId: product.category.parentId,
        },
        variants: product.variants.map((variant) => ({
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
          price: variant.price,
          isEnabled: variant.isEnabled,
          availability: variant.availabilitySummary,
        })),
        modifierGroups: product.productModifierGroups.map((group) => ({
          id: group.id,
          modifierGroupId: group.modifierGroupId,
          name: group.modifierGroup.name,
          selectionMode: group.modifierGroup.selectionMode,
          minSelect: group.minSelect,
          maxSelect: group.maxSelect,
          isRequired: group.isRequired,
          allowQuantity: group.allowQuantity,
          modifiers: group.modifierGroup.modifiers.map((modifier) => ({
            id: modifier.id,
            name: modifier.name,
            priceAdjustment: modifier.priceAdjustment,
            isAvailable: modifier.recipeAdjustments.every((adjustment) => {
              if (adjustment.quantityDelta.lessThanOrEqualTo(0)) {
                return true;
              }

              const available =
                usableByRawMaterialId.get(adjustment.rawMaterialId) ??
                new Prisma.Decimal(0);

              return available.greaterThanOrEqualTo(adjustment.quantityDelta);
            }),
          })),
        })),
      })),
    };
  }
}
