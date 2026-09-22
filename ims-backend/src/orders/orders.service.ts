import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AvailabilityBlockingReason,
  InventorySourceType,
  InventoryTransactionType,
  OrderStatus,
  OrderReversalType,
  Prisma,
  Role,
} from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import { AuthService } from '../auth/auth.service';
import { sumDecimals, toDecimal } from '../common/utils/decimal.util';
import { OutboxService } from '../events/outbox.service';
import {
  FEFOAllocator,
  MaterialRequirement,
} from '../inventory/fefo-allocator.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ModifierValidationService,
  RequestedModifierSelection,
  ValidatedModifierSelection,
} from '../recipes/modifier-validation.service';
import { RecipeResolverService } from '../recipes/recipe-resolver.service';
import { CheckoutDto, CheckoutItemDto } from './dto/checkout.dto';
import { ReverseOrderDto } from './dto/reverse-order.dto';
import { PricingService } from './pricing.service';
import { ListOrdersDto } from './dto/list-orders.dto';

type TxClient = Prisma.TransactionClient;

type PreparedCheckoutItem = {
  orderItemId?: string;
  productVariantId: string;
  productName: string;
  variantName: string;
  sku: string;
  quantity: number;
  note?: string | null;
  unitBasePrice: Prisma.Decimal;
  unitModifierAmount: Prisma.Decimal;
  unitFinalPrice: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  selectedModifiers: ValidatedModifierSelection[];
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly modifierValidationService: ModifierValidationService,
    private readonly recipeResolverService: RecipeResolverService,
    private readonly pricingService: PricingService,
    private readonly allocator: FEFOAllocator,
    private readonly inventoryLedgerService: InventoryLedgerService,
    private readonly availabilityService: AvailabilityService,
    private readonly outboxService: OutboxService,
  ) {}

  async checkout(dto: CheckoutDto, createdByUserId: string) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      select: { id: true },
    });

    if (existingOrder) {
      return {
        order: await this.getOrderById(existingOrder.id),
        idempotentReplay: true,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const preparedItems = await Promise.all(
        dto.items.map((item) => this.prepareCheckoutItem(tx, item)),
      );

      const subtotalAmount = sumDecimals(
        preparedItems.map((item) => item.lineSubtotal),
      );
      const discountAmount = this.pricingService.calculateOrderDiscount(
        subtotalAmount,
        dto.discountRate,
      );
      const totalAmount = subtotalAmount.minus(discountAmount);
      const taxAmount = this.pricingService.calculateIncludedTax(totalAmount);
      const paymentsTotal = sumDecimals(
        dto.payments.map((payment) => payment.amount),
      );

      if (dto.items.length === 0) {
        throw new BadRequestException(
          'Checkout must contain at least one item',
        );
      }

      if (paymentsTotal.lessThan(totalAmount)) {
        throw new BadRequestException(
          'Payment total is less than the order total',
        );
      }

      const order = await tx.order.create({
        data: {
          status: OrderStatus.COMPLETED,
          createdByUserId,
          idempotencyKey: dto.idempotencyKey,
          subtotalAmount,
          discountCode: dto.discountCode ?? null,
          discountRate: toDecimal(dto.discountRate ?? 0),
          discountAmount,
          taxAmount,
          totalAmount,
          totalCogsAmount: new Prisma.Decimal(0),
          notes: dto.notes ?? null,
          completedAt: new Date(),
        },
      });

      const createdOrderItems: PreparedCheckoutItem[] = [];
      for (const preparedItem of preparedItems) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productVariantId: preparedItem.productVariantId,
            quantity: preparedItem.quantity,
            unitBasePrice: preparedItem.unitBasePrice,
            unitModifierAmount: preparedItem.unitModifierAmount,
            unitFinalPrice: preparedItem.unitFinalPrice,
            lineSubtotal: preparedItem.lineSubtotal,
            unitCogsAmount: new Prisma.Decimal(0),
            lineCogsAmount: new Prisma.Decimal(0),
            note: preparedItem.note ?? null,
            productNameSnapshot: preparedItem.productName,
            variantNameSnapshot: preparedItem.variantName,
            skuSnapshot: preparedItem.sku,
          },
        });

        for (const modifier of preparedItem.selectedModifiers) {
          await tx.orderItemModifier.create({
            data: {
              orderItemId: orderItem.id,
              modifierId: modifier.modifierId,
              modifierNameSnapshot: modifier.modifierName,
              unitPriceAdjustment: modifier.unitPriceAdjustment,
              quantity: modifier.quantity,
              lineTotal: modifier.unitPriceAdjustment.mul(modifier.quantity),
            },
          });
        }

        createdOrderItems.push({
          ...preparedItem,
          orderItemId: orderItem.id,
        });
      }

      for (const payment of dto.payments) {
        await tx.orderPayment.create({
          data: {
            orderId: order.id,
            method: payment.method,
            amount: toDecimal(payment.amount),
            reference: payment.reference ?? null,
          },
        });
      }

      const requirements: MaterialRequirement[] = [];
      for (const item of createdOrderItems) {
        const resolvedRequirements =
          await this.recipeResolverService.resolveVariantRequirements(
            tx,
            item.productVariantId,
            item.selectedModifiers,
            item.quantity,
          );

        for (const requirement of resolvedRequirements) {
          requirements.push({
            rawMaterialId: requirement.rawMaterialId,
            quantity: requirement.quantity,
            orderItemId: item.orderItemId,
            productVariantId: item.productVariantId,
          });
        }
      }

      const allocations = await this.allocator.allocateAndConsume(
        tx,
        requirements,
      );

      const cogsByOrderItemId = new Map<string, Prisma.Decimal>();
      for (const allocation of allocations) {
        if (!allocation.orderItemId) {
          continue;
        }

        const current =
          cogsByOrderItemId.get(allocation.orderItemId) ??
          new Prisma.Decimal(0);
        cogsByOrderItemId.set(
          allocation.orderItemId,
          current.plus(allocation.totalCost),
        );
      }

      for (const item of createdOrderItems) {
        const lineCogs =
          cogsByOrderItemId.get(item.orderItemId!) ?? new Prisma.Decimal(0);
        const unitCogs =
          item.quantity > 0
            ? lineCogs.dividedBy(item.quantity)
            : new Prisma.Decimal(0);

        await tx.orderItem.update({
          where: { id: item.orderItemId! },
          data: {
            unitCogsAmount: unitCogs,
            lineCogsAmount: lineCogs,
          },
        });
      }

      const totalCogsAmount = sumDecimals([...cogsByOrderItemId.values()]);
      await tx.order.update({
        where: { id: order.id },
        data: {
          totalCogsAmount,
        },
      });

      await this.inventoryLedgerService.appendTransaction(tx, {
        type: InventoryTransactionType.CHECKOUT,
        sourceType: InventorySourceType.ORDER,
        sourceId: order.id,
        actorUserId: createdByUserId,
        note: `Checkout completed for order ${order.id}`,
        occurredAt: order.completedAt,
        lines: allocations.map((allocation) => ({
          rawMaterialId: allocation.rawMaterialId,
          stockBatchId: allocation.stockBatchId,
          orderItemId: allocation.orderItemId,
          productVariantId: allocation.productVariantId,
          quantityDelta: allocation.quantity.negated(),
          unitCostSnapshot: allocation.unitCost,
          totalCostDelta: allocation.totalCost.negated(),
        })),
      });

      const rawMaterialIds = [
        ...new Set(allocations.map((allocation) => allocation.rawMaterialId)),
      ];
      await this.availabilityService.refreshRawMaterialSummaries(
        tx,
        rawMaterialIds,
      );
      await this.availabilityService.refreshVariantSummariesForRawMaterialIds(
        tx,
        rawMaterialIds,
      );

      await this.outboxService.enqueue(tx, {
        aggregateType: 'order',
        aggregateId: order.id,
        eventType: 'order.completed',
        payload: {
          orderId: order.id,
          rawMaterialIds,
          totalAmount: totalAmount.toString(),
        },
      });

      return {
        order: await this.getOrderByIdWithClient(tx, order.id),
        idempotentReplay: false,
      };
    });
  }

  async listOrders(filters: ListOrdersDto = {}) {
    const orders = await this.prisma.order.findMany({
      where: this.buildListOrdersWhere(filters),
      orderBy: this.getOrderListSortOrder(),
      include: this.getOrderInclude(),
    });

    return this.attachDisplayOrderNumbers(orders);
  }

  async listOrdersPaginated(
    filters: ListOrdersDto = {},
    options: { page?: number; pageSize?: number } = {},
  ) {
    const pageSize = Math.min(Math.max(options.pageSize ?? 20, 1), 100);
    const page = Math.max(options.page ?? 1, 1);
    const skip = (page - 1) * pageSize;
    const where = this.buildListOrdersWhere(filters);

    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: this.getOrderListSortOrder(),
        include: this.getOrderInclude(),
        skip,
        take: pageSize,
      }),
    ]);

    return {
      orders: this.attachDisplayOrderNumbers(orders),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async getOrderById(orderId: string) {
    const order = await this.getOrderByIdWithClient(this.prisma, orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async refundOrder(
    orderId: string,
    dto: ReverseOrderDto,
    actorUserId: string,
  ) {
    return this.reverseOrder(
      orderId,
      dto,
      actorUserId,
      OrderReversalType.REFUND,
      OrderStatus.REFUNDED,
      InventoryTransactionType.REFUND,
      InventorySourceType.ORDER_REFUND,
      'order.refunded',
    );
  }

  getDisplayOrderNumber(orderId: string) {
    const [prefix] = orderId.split('-');
    return `ORD-${(prefix ?? orderId).toUpperCase()}`;
  }

  private async getOrderByIdWithClient(
    client: PrismaService | TxClient,
    orderId: string,
  ) {
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        items: {
          include: {
            modifiers: true,
          },
        },
        payments: true,
        reversal: {
          include: {
            actorUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return order ? this.attachDisplayOrderNumber(order) : null;
  }

  private buildListOrdersWhere(filters: ListOrdersDto): Prisma.OrderWhereInput {
    const search = filters.search?.trim();
    const orderReferenceSearch = search
      ? this.normalizeOrderReferenceSearch(search)
      : null;
    const staffSearch = filters.staffSearch?.trim();
    const andConditions: Prisma.OrderWhereInput[] = [];

    if (staffSearch) {
      andConditions.push({
        OR: [
          {
            createdBy: {
              email: {
                contains: staffSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            createdBy: {
              firstName: {
                contains: staffSearch,
                mode: 'insensitive',
              },
            },
          },
          {
            createdBy: {
              lastName: {
                contains: staffSearch,
                mode: 'insensitive',
              },
            },
          },
        ],
      });
    }

    return {
      status: filters.status,
      createdByUserId: filters.createdByUserId,
      completedAt:
        filters.from || filters.to
          ? {
              gte: filters.from ? new Date(filters.from) : undefined,
              lte: filters.to ? new Date(filters.to) : undefined,
            }
          : undefined,
      payments: filters.paymentMethod
        ? {
            some: {
              method: filters.paymentMethod,
            },
          }
        : undefined,
      items: filters.productVariantId
        ? {
            some: {
              productVariantId: filters.productVariantId,
            },
          }
        : undefined,
      AND: andConditions.length > 0 ? andConditions : undefined,
      OR: search
        ? [
            {
              id: {
                contains: search,
                mode: 'insensitive',
              },
            },
            ...(orderReferenceSearch
              ? [
                  {
                    id: {
                      startsWith: orderReferenceSearch,
                      mode: 'insensitive' as const,
                    },
                  },
                ]
              : []),
            {
              notes: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              createdBy: {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              createdBy: {
                firstName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              createdBy: {
                lastName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
            {
              items: {
                some: {
                  productNameSnapshot: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              items: {
                some: {
                  variantNameSnapshot: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
              },
            },
            {
              items: {
                some: {
                  skuSnapshot: {
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

  private getOrderListSortOrder(): Prisma.OrderOrderByWithRelationInput[] {
    return [{ completedAt: 'desc' }, { id: 'desc' }];
  }

  private getOrderInclude() {
    return {
      createdBy: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        include: {
          modifiers: true,
        },
      },
      payments: true,
      reversal: {
        include: {
          actorUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    } satisfies Prisma.OrderInclude;
  }

  private attachDisplayOrderNumber<T extends { id: string }>(order: T) {
    return {
      ...order,
      displayOrderNumber: this.getDisplayOrderNumber(order.id),
    };
  }

  private attachDisplayOrderNumbers<T extends { id: string }>(orders: T[]) {
    return orders.map((order) => this.attachDisplayOrderNumber(order));
  }

  private normalizeOrderReferenceSearch(value: string) {
    const normalized = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!normalized) {
      return null;
    }

    return normalized.startsWith('ORD') ? normalized.slice(3) : normalized;
  }

  private async reverseOrder(
    orderId: string,
    dto: ReverseOrderDto,
    actorUserId: string,
    reversalType: OrderReversalType,
    nextStatus: OrderStatus,
    transactionType: InventoryTransactionType,
    sourceType: InventorySourceType,
    eventType: string,
  ) {
    const approver = await this.authService.authorizePrivilegedApproval({
      email: dto.approverEmail,
      password: dto.approverPassword,
      allowedRoles: [Role.ADMINISTRATOR],
    });

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              modifiers: true,
            },
          },
          payments: true,
          reversal: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.COMPLETED) {
        throw new BadRequestException('Only completed orders can be reversed');
      }

      if (order.reversal) {
        throw new BadRequestException('This order has already been reversed');
      }

      const checkoutTransaction = await tx.inventoryTransaction.findFirst({
        where: {
          sourceType: InventorySourceType.ORDER,
          sourceId: order.id,
        },
        include: {
          lines: {
            include: {
              stockBatch: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!checkoutTransaction || checkoutTransaction.lines.length === 0) {
        throw new BadRequestException(
          'The original inventory transaction for this order could not be found',
        );
      }

      const reversal = await tx.orderReversal.create({
        data: {
          orderId: order.id,
          type: reversalType,
          actorUserId: approver.id,
          reasonCode: dto.reasonCode,
          note: dto.note ?? null,
          amount: order.totalAmount,
          paymentReference: dto.paymentReference ?? null,
          metadata: {
            paymentMethods: order.payments.map((payment) => ({
              method: payment.method,
              amount: payment.amount.toString(),
              reference: payment.reference,
            })),
            requestedByUserId: actorUserId,
            approvedByUserId: approver.id,
            approvedByEmail: approver.email,
          },
        },
      });

      const rawMaterialIds = [
        ...new Set(checkoutTransaction.lines.map((line) => line.rawMaterialId)),
      ];

      for (const line of checkoutTransaction.lines) {
        await tx.stockBatch.update({
          where: { id: line.stockBatchId },
          data: {
            remainingQuantity: {
              increment: toDecimal(line.quantityDelta).abs(),
            },
          },
        });
      }

      await this.inventoryLedgerService.appendTransaction(tx, {
        type: transactionType,
        sourceType,
        sourceId: reversal.id,
        actorUserId: approver.id,
        reasonCode: dto.reasonCode,
        metadata: {
          orderId: order.id,
          reversalId: reversal.id,
          reversalType,
          requestedByUserId: actorUserId,
          approvedByUserId: approver.id,
        },
        note:
          dto.note ??
          `Refund processed for order ${order.id}`,
        occurredAt: new Date(),
        lines: checkoutTransaction.lines.map((line) => ({
          rawMaterialId: line.rawMaterialId,
          stockBatchId: line.stockBatchId,
          orderItemId: line.orderItemId ?? undefined,
          productVariantId: line.productVariantId ?? undefined,
          quantityDelta: toDecimal(line.quantityDelta).abs(),
          unitCostSnapshot: line.unitCostSnapshot,
          totalCostDelta: toDecimal(line.totalCostDelta).abs(),
        })),
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: nextStatus,
        },
      });

      await this.availabilityService.refreshRawMaterialSummaries(
        tx,
        rawMaterialIds,
      );
      await this.availabilityService.refreshVariantSummariesForRawMaterialIds(
        tx,
        rawMaterialIds,
      );

      await this.outboxService.enqueue(tx, {
        aggregateType: 'order',
        aggregateId: order.id,
        eventType,
        payload: {
          orderId: order.id,
          reversalId: reversal.id,
          rawMaterialIds,
          reversalType,
          approvedByUserId: approver.id,
        },
      });

      const reversedOrder = await this.getOrderByIdWithClient(tx, order.id);

      if (!reversedOrder) {
        throw new NotFoundException('Order not found after reversal');
      }

      return reversedOrder;
    });
  }

  private async prepareCheckoutItem(
    tx: TxClient,
    item: CheckoutItemDto,
  ): Promise<PreparedCheckoutItem> {
    const variant = await tx.productVariant.findUnique({
      where: { id: item.productVariantId },
      include: {
        product: true,
        availabilitySummary: true,
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    if (!variant.product.isEnabled) {
      throw new BadRequestException('Product is disabled');
    }

    if (!variant.isEnabled) {
      throw new BadRequestException('Variant is disabled');
    }

    if (
      variant.availabilitySummary &&
      variant.availabilitySummary.blockingReason ===
        AvailabilityBlockingReason.NO_RECIPE
    ) {
      throw new BadRequestException('Variant has no recipe and cannot be sold');
    }

    if (!(await this.recipeResolverService.hasBaseRecipe(tx, variant.id))) {
      throw new BadRequestException('Variant has no recipe and cannot be sold');
    }

    const selectedModifiers =
      await this.modifierValidationService.validateSelections(
        tx,
        variant.id,
        item.modifiers as RequestedModifierSelection[],
      );

    const unitModifierAmount =
      this.pricingService.calculateUnitModifierAmount(selectedModifiers);
    const unitBasePrice = variant.price;
    const unitFinalPrice = unitBasePrice.plus(unitModifierAmount);
    const lineSubtotal = unitFinalPrice.mul(item.quantity);

    return {
      productVariantId: variant.id,
      productName: variant.product.name,
      variantName: variant.name,
      sku: variant.sku,
      quantity: item.quantity,
      note: item.note ?? null,
      unitBasePrice,
      unitModifierAmount,
      unitFinalPrice,
      lineSubtotal,
      selectedModifiers,
    };
  }
}
