import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AvailabilityBlockingReason,
  InventorySourceType,
  InventoryTransactionType,
  Prisma,
} from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import {
  getManilaBusinessDateRange,
  shiftManilaBusinessDateInput,
} from '../common/utils/manila-business-date.util';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ArchiveProductDto } from './dto/archive-product.dto';
import {
  CreateProductDto,
  CreateProductVariantInputDto,
} from './dto/create-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import {
  GetProductIngredientUsageDto,
  ProductIngredientUsageScope,
} from './dto/get-product-ingredient-usage.dto';
import {
  ListAdminProductsDto,
  ProductArchiveStateFilter,
  ProductEffectiveStatusFilter,
  ProductListSortBy,
  ProductManualAvailabilityFilter,
  SortDirection,
} from './dto/list-admin-products.dto';
import { ReplaceVariantRecipeDto } from './dto/replace-variant-recipe.dto';
import { SetManualAvailabilityDto } from './dto/set-manual-availability.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

type TxClient = Prisma.TransactionClient;

type VariantStatusInput = {
  id: string;
  isEnabled: boolean;
  availabilitySummary: {
    isInStock: boolean;
    isSellable: boolean;
    availableBaseQty: number;
    blockingReason: AvailabilityBlockingReason;
  } | null;
  recipeItems?: Array<{ rawMaterialId: string }>;
};

type ProductStatusInput = {
  archivedAt: Date | null;
  isEnabled: boolean;
  variants: VariantStatusInput[];
};

type ProductEffectiveStatus =
  | ProductEffectiveStatusFilter
  | 'MANUALLY_DISABLED';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class ProductManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availabilityService: AvailabilityService,
    private readonly ordersService: OrdersService,
  ) {}

  async listAdminProducts(filters: ListAdminProductsDto) {
    const page = Math.max(filters.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
    const where = this.buildAdminProductWhere(filters);

    const dbSortable =
      (!filters.effectiveStatus && !filters.sortBy) ||
      (!filters.effectiveStatus &&
        (filters.sortBy === ProductListSortBy.NAME ||
          filters.sortBy === ProductListSortBy.CATEGORY ||
          filters.sortBy === ProductListSortBy.UPDATED_AT));

    if (dbSortable) {
      const [totalItems, products] = await this.prisma.$transaction([
        this.prisma.product.count({ where }),
        this.prisma.product.findMany({
          where,
          include: this.getAdminProductListInclude(),
          orderBy: this.buildAdminProductOrderBy(filters),
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      const ingredientCountMap = await this.getIngredientCountMap(
        products.map((product) => product.id),
      );
      const items = products
        .map((product) =>
          this.mapAdminProductListItem(
            product,
            ingredientCountMap.get(product.id) ?? 0,
          ),
        )
        .filter((item) =>
          filters.effectiveStatus
            ? item.effectiveStatus === filters.effectiveStatus
            : true,
        );

      return {
        items,
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
        },
      };
    }

    const products = await this.prisma.product.findMany({
      where,
      include: this.getAdminProductListInclude(),
    });
    const ingredientCountMap = await this.getIngredientCountMap(
      products.map((product) => product.id),
    );
    const sorted = products
      .map((product) =>
        this.mapAdminProductListItem(
          product,
          ingredientCountMap.get(product.id) ?? 0,
        ),
      )
      .filter((item) =>
        filters.effectiveStatus
          ? item.effectiveStatus === filters.effectiveStatus
          : true,
      )
      .sort((left, right) => this.compareListItems(left, right, filters));

    const totalItems = sorted.length;
    const items = sorted.slice((page - 1) * pageSize, page * pageSize);

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getAdminProductDetail(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        archivedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        variants: {
          orderBy: [{ name: 'asc' }],
          include: {
            availabilitySummary: true,
            recipeItems: {
              orderBy: [{ rawMaterial: { name: 'asc' } }],
              include: {
                rawMaterial: {
                  include: {
                    unit: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const ingredientCountMap = await this.getIngredientCountMap([product.id]);
    const deleteEligibility = await this.getProductDeleteEligibility(
      product.id,
    );
    const status = this.deriveProductStatus(product);

    return {
      id: product.id,
      name: product.name,
      category: {
        id: product.category.id,
        name: product.category.name,
      },
      manualAvailability: product.isEnabled,
      archive: {
        archivedAt: product.archivedAt,
        archiveReason: product.archiveReason,
        archivedBy: product.archivedBy,
      },
      effectiveStatus: status.effectiveStatus,
      effectiveSellability: status.effectiveSellability,
      stockAvailability: status.stockAvailability,
      topBlockingReason: status.topBlockingReason,
      variantCount: product.variants.length,
      ingredientCount: ingredientCountMap.get(product.id) ?? 0,
      deleteEligibility,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        sku: variant.sku,
        price: variant.price.toString(),
        manualAvailability: variant.isEnabled,
        isInStock: variant.availabilitySummary?.isInStock ?? false,
        isSellable: variant.availabilitySummary?.isSellable ?? false,
        availableBaseQty: variant.availabilitySummary?.availableBaseQty ?? 0,
        blockingReason:
          variant.availabilitySummary?.blockingReason ??
          AvailabilityBlockingReason.NO_RECIPE,
        ingredientCount: variant.recipeItems.length,
        recipeSummary: {
          itemCount: variant.recipeItems.length,
          items: variant.recipeItems.map((item) => ({
            rawMaterialId: item.rawMaterialId,
            rawMaterialName: item.rawMaterial.name,
            quantity: item.quantity.toString(),
            unit: item.rawMaterial.unit,
          })),
        },
      })),
    };
  }

  async createProduct(dto: CreateProductDto, _actorUserId: string) {
    await this.ensureCategoryExists(dto.categoryId);
    this.assertDistinctInitialVariantPayload(dto.initialVariants);
    await this.ensureVariantSkusAvailable(
      dto.initialVariants.map((variant) => variant.sku),
    );

    const created = await this.prisma.$transaction(async (tx) => {
      await this.ensureProductNameAvailable(tx, dto.categoryId, dto.name);
      const product = await tx.product.create({
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          isEnabled: dto.isEnabled ?? true,
        },
      });

      const variants: Array<{ id: string }> = [];
      for (const variantInput of dto.initialVariants) {
        variants.push(
          await tx.productVariant.create({
            data: {
              productId: product.id,
              name: variantInput.name,
              sku: variantInput.sku,
              price: this.parseMoney(variantInput.price, 'Variant price'),
              isEnabled: variantInput.isEnabled ?? true,
            },
            select: { id: true },
          }),
        );
      }

      await this.availabilityService.refreshVariantSummariesForVariantIds(
        tx,
        variants.map((variant) => variant.id),
      );

      return {
        productId: product.id,
        variantIds: variants.map((variant) => variant.id),
      };
    });

    return this.getAdminProductDetail(created.productId);
  }

  async updateProduct(productId: string, dto: UpdateProductDto) {
    const existing = await this.getProductOrThrow(productId);
    if (existing.archivedAt) {
      throw new BadRequestException('Archived products cannot be edited');
    }

    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      await this.ensureCategoryExists(dto.categoryId);
    }

    const nextCategoryId = dto.categoryId ?? existing.categoryId;
    const nextName = dto.name ?? existing.name;

    if (
      nextCategoryId !== existing.categoryId ||
      nextName.trim().toLowerCase() !== existing.name.trim().toLowerCase()
    ) {
      await this.ensureProductNameAvailable(
        this.prisma,
        nextCategoryId,
        nextName,
        productId,
      );
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        name: dto.name,
        categoryId: dto.categoryId,
      },
    });

    if (dto.isEnabled !== undefined && dto.isEnabled !== existing.isEnabled) {
      await this.setProductManualAvailability(productId, {
        isEnabled: dto.isEnabled,
      });
      return this.getAdminProductDetail(productId);
    }

    return this.getAdminProductDetail(productId);
  }

  async setProductManualAvailability(
    productId: string,
    dto: SetManualAvailabilityDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        archivedAt: true,
        variants: {
          select: { id: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.archivedAt) {
      throw new BadRequestException(
        'Archived products cannot change manual availability',
      );
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        isEnabled: dto.isEnabled,
      },
    });

    await this.availabilityService.refreshVariantSummariesForVariantIds(
      this.prisma,
      product.variants.map((variant) => variant.id),
    );

    return this.getAdminProductDetail(productId);
  }

  async archiveProduct(
    productId: string,
    actorUserId: string,
    dto: ArchiveProductDto,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        archivedAt: true,
        variants: { select: { id: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.archivedAt) {
      throw new ConflictException('Product is already archived');
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        archivedAt: new Date(),
        archivedById: actorUserId,
        archiveReason: dto.reason ?? null,
      },
    });

    await this.availabilityService.refreshVariantSummariesForVariantIds(
      this.prisma,
      product.variants.map((variant) => variant.id),
    );

    return this.getAdminProductDetail(productId);
  }

  async restoreProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        categoryId: true,
        archivedAt: true,
        variants: { select: { id: true } },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.archivedAt) {
      throw new ConflictException('Product is not archived');
    }

    await this.ensureCategoryExists(product.categoryId);
    await this.ensureProductNameAvailable(
      this.prisma,
      product.categoryId,
      product.name,
      product.id,
    );

    await this.prisma.product.update({
      where: { id: productId },
      data: {
        archivedAt: null,
        archivedById: null,
        archiveReason: null,
      },
    });

    await this.availabilityService.refreshVariantSummariesForVariantIds(
      this.prisma,
      product.variants.map((variant) => variant.id),
    );

    return this.getAdminProductDetail(productId);
  }

  async getProductDeleteEligibility(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        variants: {
          select: { id: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const variantIds = product.variants.map((variant) => variant.id);

    const emptyResult = {
      eligible: true,
      blockingReasons: [] as Array<{
        code: string;
        message: string;
        count: number;
      }>,
    };

    if (variantIds.length === 0) {
      return emptyResult;
    }

    const [orderItemCount, ledgerLineCount, stockoutCount] = await Promise.all([
      this.prisma.orderItem.count({
        where: { productVariantId: { in: variantIds } },
      }),
      this.prisma.inventoryTransactionLine.count({
        where: {
          productVariantId: { in: variantIds },
        },
      }),
      this.prisma.stockoutEvent.count({
        where: {
          productVariantId: { in: variantIds },
        },
      }),
    ]);

    const blockingReasons: Array<{
      code: string;
      message: string;
      count: number;
    }> = [];
    if (orderItemCount > 0) {
      blockingReasons.push({
        code: 'HAS_ORDER_HISTORY',
        message: 'Product variants are referenced by historical orders.',
        count: orderItemCount,
      });
    }
    if (ledgerLineCount > 0) {
      blockingReasons.push({
        code: 'HAS_LEDGER_HISTORY',
        message: 'Product variants are referenced by inventory ledger history.',
        count: ledgerLineCount,
      });
    }
    if (stockoutCount > 0) {
      blockingReasons.push({
        code: 'HAS_STOCKOUT_HISTORY',
        message:
          'Product variants are referenced by retained stockout history.',
        count: stockoutCount,
      });
    }

    return blockingReasons.length === 0
      ? emptyResult
      : {
          eligible: false,
          blockingReasons,
        };
  }

  async deleteProduct(productId: string) {
    const eligibility = await this.getProductDeleteEligibility(productId);
    if (!eligibility.eligible) {
      throw new ConflictException(
        'Product is not eligible for permanent delete',
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        variants: {
          select: { id: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const variantIds = product.variants.map((variant) => variant.id);

    await this.prisma.$transaction(async (tx) => {
      if (variantIds.length > 0) {
        await tx.variantRecipeItem.deleteMany({
          where: {
            productVariantId: { in: variantIds },
          },
        });
        await tx.variantAvailabilitySummary.deleteMany({
          where: {
            productVariantId: { in: variantIds },
          },
        });
        await tx.productVariant.deleteMany({
          where: {
            id: { in: variantIds },
          },
        });
      }

      await tx.productModifierGroup.deleteMany({
        where: {
          productId,
        },
      });

      await tx.product.delete({
        where: {
          id: productId,
        },
      });
    });

    return {
      deleted: true,
      productId,
    };
  }

  async createVariant(productId: string, dto: CreateProductVariantDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        archivedAt: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.archivedAt) {
      throw new BadRequestException(
        'Cannot add variants to an archived product',
      );
    }

    await this.ensureVariantSkusAvailable([dto.sku]);
    await this.ensureVariantNameAvailable(productId, dto.name);

    await this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          name: dto.name,
          sku: dto.sku,
          price: this.parseMoney(dto.price, 'Variant price'),
          isEnabled: dto.isEnabled ?? true,
        },
        select: { id: true },
      });

      await this.availabilityService.refreshVariantSummariesForVariantIds(tx, [
        variant.id,
      ]);
    });

    return this.getAdminProductDetail(productId);
  }

  async updateVariant(variantId: string, dto: UpdateProductVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        name: true,
        sku: true,
        productId: true,
        product: {
          select: {
            archivedAt: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (variant.product.archivedAt) {
      throw new BadRequestException('Archived products cannot update variants');
    }

    if (dto.name && dto.name !== variant.name) {
      await this.ensureVariantNameAvailable(
        variant.productId,
        dto.name,
        variantId,
      );
    }

    if (dto.sku && dto.sku !== variant.sku) {
      await this.ensureVariantSkusAvailable([dto.sku], variantId);
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        name: dto.name,
        sku: dto.sku,
        price:
          dto.price !== undefined
            ? this.parseMoney(dto.price, 'Variant price')
            : undefined,
      },
    });

    await this.availabilityService.refreshVariantSummariesForVariantIds(
      this.prisma,
      [variantId],
    );

    return this.getAdminProductDetail(variant.productId);
  }

  async setVariantManualAvailability(
    variantId: string,
    dto: SetManualAvailabilityDto,
  ) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
        product: {
          select: {
            archivedAt: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (variant.product.archivedAt) {
      throw new BadRequestException(
        'Archived products cannot change variant availability',
      );
    }

    await this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        isEnabled: dto.isEnabled,
      },
    });

    await this.availabilityService.refreshVariantSummariesForVariantIds(
      this.prisma,
      [variantId],
    );

    return this.getAdminProductDetail(variant.productId);
  }

  async deleteVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    const [orderItemCount, ledgerLineCount, stockoutCount] = await Promise.all([
      this.prisma.orderItem.count({
        where: { productVariantId: variantId },
      }),
      this.prisma.inventoryTransactionLine.count({
        where: { productVariantId: variantId },
      }),
      this.prisma.stockoutEvent.count({
        where: { productVariantId: variantId },
      }),
    ]);

    const blockingReasons: string[] = [];
    if (orderItemCount > 0) {
      blockingReasons.push('order history');
    }
    if (ledgerLineCount > 0) {
      blockingReasons.push('inventory ledger history');
    }
    if (stockoutCount > 0) {
      blockingReasons.push('stockout history');
    }

    if (blockingReasons.length > 0) {
      throw new ConflictException(
        `Variant cannot be deleted because it has ${blockingReasons.join(', ')}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.variantRecipeItem.deleteMany({
        where: {
          productVariantId: variantId,
        },
      });
      await tx.variantAvailabilitySummary.deleteMany({
        where: {
          productVariantId: variantId,
        },
      });
      await tx.productVariant.delete({
        where: { id: variantId },
      });
    });

    return this.getAdminProductDetail(variant.productId);
  }

  async getVariantRecipe(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            archivedAt: true,
          },
        },
        recipeItems: {
          orderBy: [{ rawMaterial: { name: 'asc' } }],
          include: {
            rawMaterial: {
              include: {
                unit: true,
              },
            },
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    return {
      productId: variant.product.id,
      productName: variant.product.name,
      variantId: variant.id,
      variantName: variant.name,
      items: variant.recipeItems.map((item) => ({
        rawMaterialId: item.rawMaterialId,
        rawMaterialName: item.rawMaterial.name,
        quantity: item.quantity.toString(),
        unit: item.rawMaterial.unit,
      })),
    };
  }

  async replaceVariantRecipe(variantId: string, dto: ReplaceVariantRecipeDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        productId: true,
        product: {
          select: {
            archivedAt: true,
            id: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (variant.product.archivedAt) {
      throw new BadRequestException('Archived products cannot update recipes');
    }

    const seen = new Set<string>();
    const recipeItems = dto.items.map((item) => {
      if (seen.has(item.rawMaterialId)) {
        throw new BadRequestException(
          'Duplicate raw materials are not allowed',
        );
      }
      seen.add(item.rawMaterialId);

      const quantity = this.parsePositiveDecimal(
        item.quantity,
        'Recipe quantity',
      );
      return {
        rawMaterialId: item.rawMaterialId,
        quantity,
      };
    });

    const rawMaterials = await this.prisma.rawMaterial.findMany({
      where: {
        id: { in: recipeItems.map((item) => item.rawMaterialId) },
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (rawMaterials.length !== recipeItems.length) {
      throw new BadRequestException('One or more raw materials do not exist');
    }

    if (rawMaterials.some((material) => !material.isActive)) {
      throw new BadRequestException(
        'Inactive raw materials cannot be used in recipes',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.variantRecipeItem.deleteMany({
        where: {
          productVariantId: variantId,
        },
      });

      if (recipeItems.length > 0) {
        await tx.variantRecipeItem.createMany({
          data: recipeItems.map((item) => ({
            productVariantId: variantId,
            rawMaterialId: item.rawMaterialId,
            quantity: item.quantity,
          })),
        });
      }
    });

    await this.availabilityService.refreshVariantSummariesForVariantIds(
      this.prisma,
      [variantId],
    );

    return {
      recipe: await this.getVariantRecipe(variantId),
      product: await this.getAdminProductDetail(variant.productId),
    };
  }

  async getProductIngredientUsage(
    productId: string,
    filters: GetProductIngredientUsageDto,
  ) {
    const product = await this.ensureProductWithVariants(productId);
    const variantIds = product.variants.map((variant) => variant.id);
    const range = this.resolveUsageRange(filters);

    const [lines, matchingOrderItems] = await Promise.all([
      this.prisma.inventoryTransactionLine.findMany({
        where: {
          productVariantId: {
            in: variantIds,
          },
          inventoryTransaction: {
            occurredAt: {
              gte: range.startAt,
              lt: range.endAt,
            },
            type: {
              in: [
                InventoryTransactionType.CHECKOUT,
                InventoryTransactionType.VOID,
                InventoryTransactionType.REFUND,
              ],
            },
          },
        },
        include: {
          rawMaterial: {
            include: {
              unit: true,
            },
          },
          productVariant: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
          inventoryTransaction: {
            select: {
              id: true,
              type: true,
              occurredAt: true,
              sourceId: true,
            },
          },
        },
      }),
      this.prisma.orderItem.findMany({
        where: {
          productVariantId: { in: variantIds },
          order: {
            completedAt: {
              gte: range.startAt,
              lt: range.endAt,
            },
          },
        },
        select: {
          id: true,
          quantity: true,
          orderId: true,
          productVariantId: true,
        },
      }),
    ]);

    const ingredientMap = this.aggregateIngredientUsage(lines);
    const productUnitsSold = matchingOrderItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const distinctOrderCount = new Set(
      matchingOrderItems.map((item) => item.orderId),
    ).size;
    const variantBreakdown = this.buildVariantBreakdown(
      lines,
      matchingOrderItems,
    );

    return {
      productId: product.id,
      productName: product.name,
      scope: filters.scope,
      startAt: range.startAt,
      endAt: range.endAt,
      coveredDates: range.coveredDates,
      distinctOrderCount,
      productUnitsSold,
      ingredientRowCount: ingredientMap.length,
      ingredients: ingredientMap,
      variantBreakdown,
    };
  }

  async getOrderIngredientUsage(productId: string, orderId: string) {
    const product = await this.ensureProductWithVariants(productId);
    const variantIds = product.variants.map((variant) => variant.id);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: {
            productVariantId: {
              in: variantIds,
            },
          },
          select: {
            id: true,
            quantity: true,
            productVariantId: true,
            productNameSnapshot: true,
            variantNameSnapshot: true,
            skuSnapshot: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.items.length === 0) {
      throw new BadRequestException(
        'Order does not contain the selected product',
      );
    }

    const targetOrderItemIds = order.items.map((item) => item.id);
    const lines = await this.prisma.inventoryTransactionLine.findMany({
      where: {
        OR: [
          {
            inventoryTransaction: {
              type: InventoryTransactionType.CHECKOUT,
              sourceType: InventorySourceType.ORDER,
              sourceId: orderId,
            },
            productVariantId: { in: variantIds },
          },
          {
            inventoryTransaction: {
              type: {
                in: [
                  InventoryTransactionType.VOID,
                  InventoryTransactionType.REFUND,
                ],
              },
            },
            orderItemId: { in: targetOrderItemIds },
          },
        ],
      },
      include: {
        rawMaterial: {
          include: {
            unit: true,
          },
        },
        productVariant: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        inventoryTransaction: {
          select: {
            id: true,
            type: true,
            occurredAt: true,
            sourceId: true,
          },
        },
      },
    });

    const ingredients = this.aggregateIngredientUsage(lines);
    const productUnitsSold = order.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );

    return {
      orderId: order.id,
      orderReference: this.ordersService.getDisplayOrderNumber(order.id),
      orderStatus: order.status,
      completedAt: order.completedAt,
      productId: product.id,
      productName: product.name,
      productUnitsSold,
      variants: order.items.map((item) => ({
        orderItemId: item.id,
        productVariantId: item.productVariantId,
        productNameSnapshot: item.productNameSnapshot,
        variantNameSnapshot: item.variantNameSnapshot,
        skuSnapshot: item.skuSnapshot,
        quantity: item.quantity,
      })),
      ingredients,
    };
  }

  private buildAdminProductWhere(
    filters: ListAdminProductsDto,
  ): Prisma.ProductWhereInput {
    const search = filters.search?.trim();
    return {
      categoryId: filters.categoryId,
      isEnabled:
        filters.manualAvailability === ProductManualAvailabilityFilter.ENABLED
          ? true
          : filters.manualAvailability ===
              ProductManualAvailabilityFilter.DISABLED
            ? false
            : undefined,
      archivedAt:
        filters.archiveState === ProductArchiveStateFilter.ARCHIVED
          ? { not: null }
          : filters.archiveState === ProductArchiveStateFilter.ALL
            ? undefined
            : null,
      OR: search
        ? [
            {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              variants: {
                some: {
                  name: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              variants: {
                some: {
                  sku: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            },
          ]
        : undefined,
    };
  }

  private buildAdminProductOrderBy(filters: ListAdminProductsDto) {
    const direction = filters.sortDirection ?? SortDirection.ASC;
    switch (filters.sortBy) {
      case ProductListSortBy.CATEGORY:
        return [{ category: { name: direction } }, { name: 'asc' as const }];
      case ProductListSortBy.UPDATED_AT:
        return [{ updatedAt: direction }, { name: 'asc' as const }];
      case ProductListSortBy.NAME:
      default:
        return [{ name: direction }, { id: 'asc' as const }];
    }
  }

  private getAdminProductListInclude(): Prisma.ProductInclude {
    return {
      category: true,
      variants: {
        include: {
          availabilitySummary: true,
        },
      },
    };
  }

  private mapAdminProductListItem(product: any, ingredientCount: number) {
    const status = this.deriveProductStatus(product);
    return {
      id: product.id,
      name: product.name,
      category: {
        id: product.category.id,
        name: product.category.name,
      },
      variantCount: product.variants.length,
      ingredientCount,
      manualAvailability: product.isEnabled,
      stockAvailability: status.stockAvailability,
      effectiveSellability: status.effectiveSellability,
      effectiveStatus: status.effectiveStatus,
      topBlockingReason: status.topBlockingReason,
      archivedAt: product.archivedAt,
      updatedAt: product.updatedAt,
    };
  }

  private deriveProductStatus(product: ProductStatusInput) {
    const totalVariantCount = product.variants.length;
    const enabledVariants = product.variants.filter(
      (variant) => variant.isEnabled,
    );
    const sellableVariants = enabledVariants.filter(
      (variant) => variant.availabilitySummary?.isSellable,
    );
    const blockingReasons = enabledVariants
      .map((variant) => variant.availabilitySummary?.blockingReason)
      .filter(Boolean) as AvailabilityBlockingReason[];

    let effectiveStatus: ProductEffectiveStatus;
    if (product.archivedAt) {
      effectiveStatus = ProductEffectiveStatusFilter.ARCHIVED;
    } else if (!product.isEnabled) {
      effectiveStatus = ProductEffectiveStatusFilter.MANUALLY_DISABLED;
    } else if (
      sellableVariants.length > 0 &&
      sellableVariants.length < totalVariantCount
    ) {
      effectiveStatus = ProductEffectiveStatusFilter.PARTIALLY_AVAILABLE;
    } else if (sellableVariants.length > 0) {
      effectiveStatus = ProductEffectiveStatusFilter.SELLABLE;
    } else if (
      enabledVariants.length > 0 &&
      enabledVariants.every(
        (variant) =>
          variant.availabilitySummary?.blockingReason ===
          AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      )
    ) {
      effectiveStatus = ProductEffectiveStatusFilter.OUT_OF_STOCK;
    } else if (
      enabledVariants.length > 0 &&
      enabledVariants.every(
        (variant) =>
          variant.availabilitySummary?.blockingReason ===
          AvailabilityBlockingReason.NO_RECIPE,
      )
    ) {
      effectiveStatus = ProductEffectiveStatusFilter.NO_VALID_RECIPE;
    } else {
      effectiveStatus = ProductEffectiveStatusFilter.NO_SELLABLE_VARIANT;
    }

    const topBlockingReason =
      blockingReasons.length === 0
        ? null
        : ([...blockingReasons].sort(
            (left, right) =>
              blockingReasons.filter((value) => value === right).length -
              blockingReasons.filter((value) => value === left).length,
          )[0] ?? null);

    return {
      effectiveStatus,
      effectiveSellability:
        effectiveStatus === ProductEffectiveStatusFilter.SELLABLE ||
        effectiveStatus === ProductEffectiveStatusFilter.PARTIALLY_AVAILABLE,
      stockAvailability: {
        status:
          sellableVariants.length === 0
            ? 'UNAVAILABLE'
            : sellableVariants.length === totalVariantCount &&
                totalVariantCount > 0
              ? 'AVAILABLE'
              : 'PARTIAL',
        sellableVariantCount: sellableVariants.length,
        totalVariantCount,
      },
      topBlockingReason,
    };
  }

  private async getIngredientCountMap(productIds: string[]) {
    if (productIds.length === 0) {
      return new Map<string, number>();
    }

    const [variantRecipeItems, modifierAdjustments] = await Promise.all([
      this.prisma.variantRecipeItem.findMany({
        where: {
          productVariant: {
            productId: {
              in: productIds,
            },
          },
        },
        select: {
          rawMaterialId: true,
          productVariant: {
            select: {
              productId: true,
            },
          },
        },
      }),
      this.prisma.modifierRecipeAdjustment.findMany({
        where: {
          quantityDelta: {
            gt: 0,
          },
          modifier: {
            modifierGroup: {
              productModifierGroups: {
                some: {
                  productId: {
                    in: productIds,
                  },
                },
              },
            },
          },
        },
        select: {
          rawMaterialId: true,
          modifier: {
            select: {
              modifierGroup: {
                select: {
                  productModifierGroups: {
                    where: {
                      productId: {
                        in: productIds,
                      },
                    },
                    select: {
                      productId: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const map = new Map<string, Set<string>>();
    for (const productId of productIds) {
      map.set(productId, new Set<string>());
    }

    for (const item of variantRecipeItems) {
      map.get(item.productVariant.productId)?.add(item.rawMaterialId);
    }

    for (const adjustment of modifierAdjustments) {
      for (const assignment of adjustment.modifier.modifierGroup
        .productModifierGroups) {
        map.get(assignment.productId)?.add(adjustment.rawMaterialId);
      }
    }

    return new Map(
      [...map.entries()].map(([productId, rawMaterialIds]) => [
        productId,
        rawMaterialIds.size,
      ]),
    );
  }

  private compareListItems(
    left: ReturnType<ProductManagementService['mapAdminProductListItem']>,
    right: ReturnType<ProductManagementService['mapAdminProductListItem']>,
    filters: ListAdminProductsDto,
  ) {
    const direction = filters.sortDirection === SortDirection.DESC ? -1 : 1;
    const compareString = (a: string, b: string) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' });

    switch (filters.sortBy) {
      case ProductListSortBy.VARIANT_COUNT:
        return (
          (left.variantCount - right.variantCount) * direction ||
          compareString(left.name, right.name)
        );
      case ProductListSortBy.INGREDIENT_COUNT:
        return (
          (left.ingredientCount - right.ingredientCount) * direction ||
          compareString(left.name, right.name)
        );
      default:
        return compareString(left.name, right.name) * direction;
    }
  }

  private resolveUsageRange(filters: GetProductIngredientUsageDto) {
    if (filters.scope === ProductIngredientUsageScope.ONE_DAY) {
      if (!filters.businessDate) {
        throw new BadRequestException('businessDate is required for ONE_DAY');
      }
      const oneDay = getManilaBusinessDateRange(filters.businessDate);
      return {
        startAt: oneDay.from,
        endAt: new Date(
          getManilaBusinessDateRange(
            shiftManilaBusinessDateInput(filters.businessDate, 1),
          ).from,
        ),
        coveredDates: [filters.businessDate],
      };
    }

    const endDateInput = filters.endDate;
    if (!endDateInput) {
      throw new BadRequestException('endDate is required for multi-day scopes');
    }

    const days =
      filters.scope === ProductIngredientUsageScope.LAST_7_DAYS ? 7 : 30;
    const startDateInput = shiftManilaBusinessDateInput(
      endDateInput,
      -(days - 1),
    );
    const startAt = getManilaBusinessDateRange(startDateInput).from;
    const endAt = getManilaBusinessDateRange(
      shiftManilaBusinessDateInput(endDateInput, 1),
    ).from;
    const coveredDates: string[] = [];
    for (let index = 0; index < days; index += 1) {
      coveredDates.push(shiftManilaBusinessDateInput(startDateInput, index));
    }

    return {
      startAt,
      endAt,
      coveredDates,
    };
  }

  private aggregateIngredientUsage(
    lines: Array<
      Prisma.InventoryTransactionLineGetPayload<{
        include: {
          rawMaterial: {
            include: {
              unit: true;
            };
          };
          productVariant: {
            select: {
              id: true;
              name: true;
              sku: true;
            };
          };
          inventoryTransaction: {
            select: {
              id: true;
              type: true;
              occurredAt: true;
              sourceId: true;
            };
          };
        };
      }>
    >,
  ) {
    const materialMap = new Map<
      string,
      {
        rawMaterialId: string;
        rawMaterialName: string;
        unit: {
          id: string;
          code: string;
          name: string;
          dimension: string;
        };
        grossQuantity: Prisma.Decimal;
        reversedQuantity: Prisma.Decimal;
        netQuantity: Prisma.Decimal;
        grossCost: Prisma.Decimal;
        reversedCost: Prisma.Decimal;
        netCost: Prisma.Decimal;
      }
    >();

    for (const line of lines) {
      const current = materialMap.get(line.rawMaterialId) ?? {
        rawMaterialId: line.rawMaterialId,
        rawMaterialName: line.rawMaterial.name,
        unit: {
          id: line.rawMaterial.unit.id,
          code: line.rawMaterial.unit.code,
          name: line.rawMaterial.unit.name,
          dimension: line.rawMaterial.unit.dimension,
        },
        grossQuantity: ZERO,
        reversedQuantity: ZERO,
        netQuantity: ZERO,
        grossCost: ZERO,
        reversedCost: ZERO,
        netCost: ZERO,
      };

      if (
        line.inventoryTransaction.type === InventoryTransactionType.CHECKOUT
      ) {
        current.grossQuantity = current.grossQuantity.plus(
          line.quantityDelta.abs(),
        );
        current.grossCost = current.grossCost.plus(line.totalCostDelta.abs());
      } else {
        current.reversedQuantity = current.reversedQuantity.plus(
          line.quantityDelta.abs(),
        );
        current.reversedCost = current.reversedCost.plus(
          line.totalCostDelta.abs(),
        );
      }

      current.netQuantity = current.grossQuantity.minus(
        current.reversedQuantity,
      );
      current.netCost = current.grossCost.minus(current.reversedCost);
      materialMap.set(line.rawMaterialId, current);
    }

    return [...materialMap.values()]
      .sort((left, right) =>
        left.rawMaterialName.localeCompare(right.rawMaterialName),
      )
      .map((item) => ({
        ...item,
        grossQuantity: item.grossQuantity.toString(),
        reversedQuantity: item.reversedQuantity.toString(),
        netQuantity: item.netQuantity.toString(),
        grossCost: item.grossCost.toString(),
        reversedCost: item.reversedCost.toString(),
        netCost: item.netCost.toString(),
      }));
  }

  private buildVariantBreakdown(
    lines: Array<
      Prisma.InventoryTransactionLineGetPayload<{
        include: {
          productVariant: {
            select: {
              id: true;
              name: true;
              sku: true;
            };
          };
          inventoryTransaction: {
            select: {
              type: true;
            };
          };
        };
      }>
    >,
    matchingOrderItems: Array<{
      quantity: number;
      orderId: string;
      productVariantId: string;
    }>,
  ) {
    const orderUnitsByVariantId = new Map<string, number>();
    for (const item of matchingOrderItems) {
      orderUnitsByVariantId.set(
        item.productVariantId,
        (orderUnitsByVariantId.get(item.productVariantId) ?? 0) + item.quantity,
      );
    }

    const variantMap = new Map<
      string,
      {
        productVariantId: string;
        variantName: string;
        sku: string;
        productUnitsSold: number;
        grossIngredientCost: Prisma.Decimal;
        reversedIngredientCost: Prisma.Decimal;
        netIngredientCost: Prisma.Decimal;
      }
    >();

    for (const line of lines) {
      if (!line.productVariant) {
        continue;
      }

      const current = variantMap.get(line.productVariant.id) ?? {
        productVariantId: line.productVariant.id,
        variantName: line.productVariant.name,
        sku: line.productVariant.sku,
        productUnitsSold:
          orderUnitsByVariantId.get(line.productVariant.id) ?? 0,
        grossIngredientCost: ZERO,
        reversedIngredientCost: ZERO,
        netIngredientCost: ZERO,
      };

      if (
        line.inventoryTransaction.type === InventoryTransactionType.CHECKOUT
      ) {
        current.grossIngredientCost = current.grossIngredientCost.plus(
          line.totalCostDelta.abs(),
        );
      } else {
        current.reversedIngredientCost = current.reversedIngredientCost.plus(
          line.totalCostDelta.abs(),
        );
      }

      current.netIngredientCost = current.grossIngredientCost.minus(
        current.reversedIngredientCost,
      );

      variantMap.set(line.productVariant.id, current);
    }

    return [...variantMap.values()]
      .sort((left, right) => left.variantName.localeCompare(right.variantName))
      .map((item) => ({
        ...item,
        grossIngredientCost: item.grossIngredientCost.toString(),
        reversedIngredientCost: item.reversedIngredientCost.toString(),
        netIngredientCost: item.netIngredientCost.toString(),
      }));
  }

  private async ensureProductWithVariants(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        variants: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new BadRequestException('Category not found');
    }
  }

  private async ensureProductNameAvailable(
    client: PrismaService | TxClient,
    categoryId: string,
    name: string,
    excludeProductId?: string,
  ) {
    const existing = await client.product.findFirst({
      where: {
        categoryId,
        name,
        id: excludeProductId ? { not: excludeProductId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'Product name already exists in the category',
      );
    }
  }

  private async ensureVariantNameAvailable(
    productId: string,
    name: string,
    excludeVariantId?: string,
  ) {
    const existing = await this.prisma.productVariant.findFirst({
      where: {
        productId,
        name,
        id: excludeVariantId ? { not: excludeVariantId } : undefined,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        'Variant name already exists for the product',
      );
    }
  }

  private async ensureVariantSkusAvailable(
    skus: string[],
    excludeVariantId?: string,
  ) {
    if (skus.length === 0) {
      return;
    }

    const existing = await this.prisma.productVariant.findMany({
      where: {
        sku: { in: skus },
        id: excludeVariantId ? { not: excludeVariantId } : undefined,
      },
      select: { sku: true },
    });

    if (existing.length > 0) {
      throw new ConflictException(
        `Variant SKU already exists: ${existing.map((item) => item.sku).join(', ')}`,
      );
    }
  }

  private assertDistinctInitialVariantPayload(
    variants: CreateProductVariantInputDto[],
  ) {
    const names = new Set<string>();
    const skus = new Set<string>();

    for (const variant of variants) {
      const normalizedName = variant.name.trim().toLowerCase();
      const normalizedSku = variant.sku.trim().toLowerCase();
      if (names.has(normalizedName)) {
        throw new BadRequestException(
          'Duplicate variant names are not allowed',
        );
      }
      if (skus.has(normalizedSku)) {
        throw new BadRequestException('Duplicate variant SKUs are not allowed');
      }
      names.add(normalizedName);
      skus.add(normalizedSku);
    }
  }

  private parseMoney(value: string, label: string) {
    try {
      return new Prisma.Decimal(value);
    } catch {
      throw new BadRequestException(`${label} must be a valid decimal value`);
    }
  }

  private parsePositiveDecimal(value: string, label: string) {
    const decimal = this.parseMoney(value, label);
    if (!decimal.greaterThan(0)) {
      throw new BadRequestException(`${label} must be greater than zero`);
    }
    return decimal;
  }

  private async getProductOrThrow(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        categoryId: true,
        isEnabled: true,
        archivedAt: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
