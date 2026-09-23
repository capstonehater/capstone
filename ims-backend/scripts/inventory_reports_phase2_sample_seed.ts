import {
  AvailabilityBlockingReason,
  OrderStatus,
  Prisma,
  PrismaClient,
  Role,
  StockoutEntityType,
  UnitDimension,
} from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE = {
  userId: 'inventory_reports_phase2_sample_user',
  categoryId: 'inventory_reports_phase2_sample_category',
  productId: 'inventory_reports_phase2_sample_product',
  variants: {
    espresso: 'inventory_reports_phase2_variant_espresso',
    latte: 'inventory_reports_phase2_variant_latte',
    mocha: 'inventory_reports_phase2_variant_mocha',
    americano: 'inventory_reports_phase2_variant_americano',
  },
  unitIds: {
    mass: 'inventory_reports_phase2_unit_mass',
    volume: 'inventory_reports_phase2_unit_volume',
  },
  materials: {
    beans: 'inventory_reports_phase2_material_beans',
    milk: 'inventory_reports_phase2_material_milk',
  },
  orders: {
    espresso: 'inventory_reports_phase2_order_espresso',
    latte: 'inventory_reports_phase2_order_latte',
    mocha: 'inventory_reports_phase2_order_mocha',
  },
  orderItems: {
    espresso: 'inventory_reports_phase2_item_espresso',
    latte: 'inventory_reports_phase2_item_latte',
    mocha: 'inventory_reports_phase2_item_mocha',
  },
  stockoutEvents: {
    beans: 'inventory_reports_phase2_stockout_beans',
    milk: 'inventory_reports_phase2_stockout_milk',
  },
  availabilityEvents: {
    espressoBaseline: 'inventory_reports_phase2_availability_espresso_baseline',
    espressoDown: 'inventory_reports_phase2_availability_espresso_down',
    espressoUp: 'inventory_reports_phase2_availability_espresso_up',
    latteBaseline: 'inventory_reports_phase2_availability_latte_baseline',
    latteDown: 'inventory_reports_phase2_availability_latte_down',
    latteUp: 'inventory_reports_phase2_availability_latte_up',
    mochaUp: 'inventory_reports_phase2_availability_mocha_up',
    mochaDown: 'inventory_reports_phase2_availability_mocha_down',
    americanoBaseline: 'inventory_reports_phase2_availability_americano_baseline',
  },
};

function decimal(value: string | number) {
  return new Prisma.Decimal(value);
}

async function main() {
  await prisma.user.upsert({
    where: { email: 'inventory-reports-phase2-sample@dev.local' },
    update: {
      id: SAMPLE.userId,
      username: 'inventory_reports_phase2_sample',
      firstName: 'Inventory',
      lastName: 'Phase2',
      role: Role.ADMINISTRATOR,
      isActive: false,
      accountStatus: 'INACTIVE',
    },
    create: {
      id: SAMPLE.userId,
      username: 'inventory_reports_phase2_sample',
      email: 'inventory-reports-phase2-sample@dev.local',
      passwordHash: 'sample-only-not-for-login',
      firstName: 'Inventory',
      lastName: 'Phase2',
      role: Role.ADMINISTRATOR,
      isActive: false,
      accountStatus: 'INACTIVE',
    },
  });

  await prisma.unit.upsert({
    where: { code: 'IRP2-MASS' },
    update: {
      id: SAMPLE.unitIds.mass,
      name: 'Inventory Reports Phase 2 Mass',
      dimension: UnitDimension.MASS,
      conversionFactor: decimal('1'),
    },
    create: {
      id: SAMPLE.unitIds.mass,
      code: 'IRP2-MASS',
      name: 'Inventory Reports Phase 2 Mass',
      dimension: UnitDimension.MASS,
      conversionFactor: decimal('1'),
    },
  });

  await prisma.unit.upsert({
    where: { code: 'IRP2-VOLUME' },
    update: {
      id: SAMPLE.unitIds.volume,
      name: 'Inventory Reports Phase 2 Volume',
      dimension: UnitDimension.VOLUME,
      conversionFactor: decimal('1'),
    },
    create: {
      id: SAMPLE.unitIds.volume,
      code: 'IRP2-VOLUME',
      name: 'Inventory Reports Phase 2 Volume',
      dimension: UnitDimension.VOLUME,
      conversionFactor: decimal('1'),
    },
  });

  await prisma.category.upsert({
    where: { id: SAMPLE.categoryId },
    update: {
      name: 'Inventory Reports Phase 2 Validation',
      parentId: null,
      sortOrder: 0,
    },
    create: {
      id: SAMPLE.categoryId,
      name: 'Inventory Reports Phase 2 Validation',
      sortOrder: 0,
    },
  });

  await prisma.product.upsert({
    where: { id: SAMPLE.productId },
    update: {
      categoryId: SAMPLE.categoryId,
      name: 'Inventory Reports Phase 2 Beverage',
      isEnabled: true,
    },
    create: {
      id: SAMPLE.productId,
      categoryId: SAMPLE.categoryId,
      name: 'Inventory Reports Phase 2 Beverage',
      isEnabled: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { sku: 'IRP2-ESPRESSO' },
    update: {
      id: SAMPLE.variants.espresso,
      productId: SAMPLE.productId,
      name: 'Espresso',
      price: decimal('120'),
      isEnabled: true,
    },
    create: {
      id: SAMPLE.variants.espresso,
      productId: SAMPLE.productId,
      name: 'Espresso',
      sku: 'IRP2-ESPRESSO',
      price: decimal('120'),
      isEnabled: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { sku: 'IRP2-LATTE' },
    update: {
      id: SAMPLE.variants.latte,
      productId: SAMPLE.productId,
      name: 'Latte',
      price: decimal('110'),
      isEnabled: true,
    },
    create: {
      id: SAMPLE.variants.latte,
      productId: SAMPLE.productId,
      name: 'Latte',
      sku: 'IRP2-LATTE',
      price: decimal('110'),
      isEnabled: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { sku: 'IRP2-MOCHA' },
    update: {
      id: SAMPLE.variants.mocha,
      productId: SAMPLE.productId,
      name: 'Mocha',
      price: decimal('100'),
      isEnabled: true,
    },
    create: {
      id: SAMPLE.variants.mocha,
      productId: SAMPLE.productId,
      name: 'Mocha',
      sku: 'IRP2-MOCHA',
      price: decimal('100'),
      isEnabled: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { sku: 'IRP2-AMERICANO' },
    update: {
      id: SAMPLE.variants.americano,
      productId: SAMPLE.productId,
      name: 'Americano',
      price: decimal('95'),
      isEnabled: true,
    },
    create: {
      id: SAMPLE.variants.americano,
      productId: SAMPLE.productId,
      name: 'Americano',
      sku: 'IRP2-AMERICANO',
      price: decimal('95'),
      isEnabled: true,
    },
  });

  await prisma.rawMaterial.upsert({
    where: { sku: 'IRP2-BEANS' },
    update: {
      id: SAMPLE.materials.beans,
      unitId: SAMPLE.unitIds.mass,
      name: 'Inventory Reports Phase 2 Beans',
      reorderPoint: decimal('5'),
      isActive: true,
    },
    create: {
      id: SAMPLE.materials.beans,
      unitId: SAMPLE.unitIds.mass,
      name: 'Inventory Reports Phase 2 Beans',
      sku: 'IRP2-BEANS',
      reorderPoint: decimal('5'),
      isActive: true,
    },
  });

  await prisma.rawMaterial.upsert({
    where: { sku: 'IRP2-MILK' },
    update: {
      id: SAMPLE.materials.milk,
      unitId: SAMPLE.unitIds.volume,
      name: 'Inventory Reports Phase 2 Milk',
      reorderPoint: decimal('4'),
      isActive: true,
    },
    create: {
      id: SAMPLE.materials.milk,
      unitId: SAMPLE.unitIds.volume,
      name: 'Inventory Reports Phase 2 Milk',
      sku: 'IRP2-MILK',
      reorderPoint: decimal('4'),
      isActive: true,
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.mocha },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase2-order-mocha',
      subtotalAmount: decimal('1000'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1000'),
      totalCogsAmount: decimal('350'),
      completedAt: new Date('2036-05-01T09:00:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.mocha,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase2-order-mocha',
      subtotalAmount: decimal('1000'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1000'),
      totalCogsAmount: decimal('350'),
      completedAt: new Date('2036-05-01T09:00:00+08:00'),
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.espresso },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase2-order-espresso',
      subtotalAmount: decimal('960'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('960'),
      totalCogsAmount: decimal('320'),
      completedAt: new Date('2036-05-01T13:00:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.espresso,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase2-order-espresso',
      subtotalAmount: decimal('960'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('960'),
      totalCogsAmount: decimal('320'),
      completedAt: new Date('2036-05-01T13:00:00+08:00'),
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.latte },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase2-order-latte',
      subtotalAmount: decimal('550'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('550'),
      totalCogsAmount: decimal('220'),
      completedAt: new Date('2036-05-02T10:00:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.latte,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase2-order-latte',
      subtotalAmount: decimal('550'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('550'),
      totalCogsAmount: decimal('220'),
      completedAt: new Date('2036-05-02T10:00:00+08:00'),
    },
  });

  await prisma.orderItem.upsert({
    where: { id: SAMPLE.orderItems.mocha },
    update: {
      orderId: SAMPLE.orders.mocha,
      productVariantId: SAMPLE.variants.mocha,
      quantity: 10,
      unitBasePrice: decimal('100'),
      unitModifierAmount: decimal('0'),
      unitFinalPrice: decimal('100'),
      lineSubtotal: decimal('1000'),
      unitCogsAmount: decimal('35'),
      lineCogsAmount: decimal('350'),
      note: 'Inventory Reports Phase 2 mocha sample item',
      productNameSnapshot: 'Inventory Reports Phase 2 Beverage',
      variantNameSnapshot: 'Mocha',
      skuSnapshot: 'IRP2-MOCHA',
    },
    create: {
      id: SAMPLE.orderItems.mocha,
      orderId: SAMPLE.orders.mocha,
      productVariantId: SAMPLE.variants.mocha,
      quantity: 10,
      unitBasePrice: decimal('100'),
      unitModifierAmount: decimal('0'),
      unitFinalPrice: decimal('100'),
      lineSubtotal: decimal('1000'),
      unitCogsAmount: decimal('35'),
      lineCogsAmount: decimal('350'),
      note: 'Inventory Reports Phase 2 mocha sample item',
      productNameSnapshot: 'Inventory Reports Phase 2 Beverage',
      variantNameSnapshot: 'Mocha',
      skuSnapshot: 'IRP2-MOCHA',
    },
  });

  await prisma.orderItem.upsert({
    where: { id: SAMPLE.orderItems.espresso },
    update: {
      orderId: SAMPLE.orders.espresso,
      productVariantId: SAMPLE.variants.espresso,
      quantity: 8,
      unitBasePrice: decimal('120'),
      unitModifierAmount: decimal('0'),
      unitFinalPrice: decimal('120'),
      lineSubtotal: decimal('960'),
      unitCogsAmount: decimal('40'),
      lineCogsAmount: decimal('320'),
      note: 'Inventory Reports Phase 2 espresso sample item',
      productNameSnapshot: 'Inventory Reports Phase 2 Beverage',
      variantNameSnapshot: 'Espresso',
      skuSnapshot: 'IRP2-ESPRESSO',
    },
    create: {
      id: SAMPLE.orderItems.espresso,
      orderId: SAMPLE.orders.espresso,
      productVariantId: SAMPLE.variants.espresso,
      quantity: 8,
      unitBasePrice: decimal('120'),
      unitModifierAmount: decimal('0'),
      unitFinalPrice: decimal('120'),
      lineSubtotal: decimal('960'),
      unitCogsAmount: decimal('40'),
      lineCogsAmount: decimal('320'),
      note: 'Inventory Reports Phase 2 espresso sample item',
      productNameSnapshot: 'Inventory Reports Phase 2 Beverage',
      variantNameSnapshot: 'Espresso',
      skuSnapshot: 'IRP2-ESPRESSO',
    },
  });

  await prisma.orderItem.upsert({
    where: { id: SAMPLE.orderItems.latte },
    update: {
      orderId: SAMPLE.orders.latte,
      productVariantId: SAMPLE.variants.latte,
      quantity: 5,
      unitBasePrice: decimal('110'),
      unitModifierAmount: decimal('0'),
      unitFinalPrice: decimal('110'),
      lineSubtotal: decimal('550'),
      unitCogsAmount: decimal('44'),
      lineCogsAmount: decimal('220'),
      note: 'Inventory Reports Phase 2 latte sample item',
      productNameSnapshot: 'Inventory Reports Phase 2 Beverage',
      variantNameSnapshot: 'Latte',
      skuSnapshot: 'IRP2-LATTE',
    },
    create: {
      id: SAMPLE.orderItems.latte,
      orderId: SAMPLE.orders.latte,
      productVariantId: SAMPLE.variants.latte,
      quantity: 5,
      unitBasePrice: decimal('110'),
      unitModifierAmount: decimal('0'),
      unitFinalPrice: decimal('110'),
      lineSubtotal: decimal('550'),
      unitCogsAmount: decimal('44'),
      lineCogsAmount: decimal('220'),
      note: 'Inventory Reports Phase 2 latte sample item',
      productNameSnapshot: 'Inventory Reports Phase 2 Beverage',
      variantNameSnapshot: 'Latte',
      skuSnapshot: 'IRP2-LATTE',
    },
  });

  await prisma.stockoutEvent.upsert({
    where: { id: SAMPLE.stockoutEvents.beans },
    update: {
      entityType: StockoutEntityType.RAW_MATERIAL,
      entityId: SAMPLE.materials.beans,
      rawMaterialId: SAMPLE.materials.beans,
      productVariantId: null,
      startedAt: new Date('2036-05-01T06:00:00+08:00'),
      endedAt: new Date('2036-05-01T12:00:00+08:00'),
      blockingContext: 'USABLE_QUANTITY_ZERO',
    },
    create: {
      id: SAMPLE.stockoutEvents.beans,
      entityType: StockoutEntityType.RAW_MATERIAL,
      entityId: SAMPLE.materials.beans,
      rawMaterialId: SAMPLE.materials.beans,
      startedAt: new Date('2036-05-01T06:00:00+08:00'),
      endedAt: new Date('2036-05-01T12:00:00+08:00'),
      blockingContext: 'USABLE_QUANTITY_ZERO',
    },
  });

  await prisma.stockoutEvent.upsert({
    where: { id: SAMPLE.stockoutEvents.milk },
    update: {
      entityType: StockoutEntityType.RAW_MATERIAL,
      entityId: SAMPLE.materials.milk,
      rawMaterialId: SAMPLE.materials.milk,
      productVariantId: null,
      startedAt: new Date('2036-05-02T12:00:00+08:00'),
      endedAt: null,
      blockingContext: 'USABLE_QUANTITY_ZERO',
    },
    create: {
      id: SAMPLE.stockoutEvents.milk,
      entityType: StockoutEntityType.RAW_MATERIAL,
      entityId: SAMPLE.materials.milk,
      rawMaterialId: SAMPLE.materials.milk,
      startedAt: new Date('2036-05-02T12:00:00+08:00'),
      endedAt: null,
      blockingContext: 'USABLE_QUANTITY_ZERO',
    },
  });

  const availabilityEvents = [
    {
      id: SAMPLE.availabilityEvents.espressoBaseline,
      productVariantId: SAMPLE.variants.espresso,
      previousIsSellable: null,
      newIsSellable: true,
      previousBlockingReason: null,
      blockingReason: AvailabilityBlockingReason.NONE,
      availableBaseQty: 20,
      occurredAt: new Date('2036-04-30T23:00:00+08:00'),
    },
    {
      id: SAMPLE.availabilityEvents.espressoDown,
      productVariantId: SAMPLE.variants.espresso,
      previousIsSellable: true,
      newIsSellable: false,
      previousBlockingReason: AvailabilityBlockingReason.NONE,
      blockingReason: AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      availableBaseQty: 0,
      occurredAt: new Date('2036-05-01T12:00:00+08:00'),
    },
    {
      id: SAMPLE.availabilityEvents.espressoUp,
      productVariantId: SAMPLE.variants.espresso,
      previousIsSellable: false,
      newIsSellable: true,
      previousBlockingReason: AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      blockingReason: AvailabilityBlockingReason.NONE,
      availableBaseQty: 10,
      occurredAt: new Date('2036-05-02T00:00:00+08:00'),
    },
    {
      id: SAMPLE.availabilityEvents.latteBaseline,
      productVariantId: SAMPLE.variants.latte,
      previousIsSellable: null,
      newIsSellable: true,
      previousBlockingReason: null,
      blockingReason: AvailabilityBlockingReason.NONE,
      availableBaseQty: 15,
      occurredAt: new Date('2036-04-30T23:00:00+08:00'),
    },
    {
      id: SAMPLE.availabilityEvents.latteDown,
      productVariantId: SAMPLE.variants.latte,
      previousIsSellable: true,
      newIsSellable: false,
      previousBlockingReason: AvailabilityBlockingReason.NONE,
      blockingReason: AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      availableBaseQty: 0,
      occurredAt: new Date('2036-05-01T00:00:00+08:00'),
    },
    {
      id: SAMPLE.availabilityEvents.latteUp,
      productVariantId: SAMPLE.variants.latte,
      previousIsSellable: false,
      newIsSellable: true,
      previousBlockingReason: AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      blockingReason: AvailabilityBlockingReason.NONE,
      availableBaseQty: 8,
      occurredAt: new Date('2036-05-02T00:00:00+08:00'),
    },
    {
      id: SAMPLE.availabilityEvents.mochaUp,
      productVariantId: SAMPLE.variants.mocha,
      previousIsSellable: null,
      newIsSellable: true,
      previousBlockingReason: null,
      blockingReason: AvailabilityBlockingReason.NONE,
      availableBaseQty: 12,
      occurredAt: new Date('2036-05-01T08:00:00+08:00'),
    },
    {
      id: SAMPLE.availabilityEvents.mochaDown,
      productVariantId: SAMPLE.variants.mocha,
      previousIsSellable: true,
      newIsSellable: false,
      previousBlockingReason: AvailabilityBlockingReason.NONE,
      blockingReason: AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      availableBaseQty: 0,
      occurredAt: new Date('2036-05-02T12:00:00+08:00'),
    },
    {
      id: SAMPLE.availabilityEvents.americanoBaseline,
      productVariantId: SAMPLE.variants.americano,
      previousIsSellable: null,
      newIsSellable: true,
      previousBlockingReason: null,
      blockingReason: AvailabilityBlockingReason.NONE,
      availableBaseQty: 20,
      occurredAt: new Date('2036-04-30T23:00:00+08:00'),
    },
  ];

  for (const event of availabilityEvents) {
    await prisma.variantAvailabilityEvent.upsert({
      where: { id: event.id },
      update: event,
      create: event,
    });
  }

  console.log('Inventory Reports Phase 2 sample data is ready.');
  console.log('Sample stockout durations: beans=6h recovered, milk=12h open within the full range.');
  console.log('Sample availability: Espresso=75%, Latte=50%, Mocha=untracked, Americano=100%.');
  console.log('Sample top sellers: Mocha qty=10, Espresso qty=8, Latte qty=5.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
