import {
  InventorySourceType,
  InventoryTransactionType,
  OrderStatus,
  Prisma,
  PrismaClient,
  Role,
  UnitDimension,
} from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE = {
  userId: 'inventory_reports_phase1_sample_user',
  categoryId: 'inventory_reports_phase1_sample_category',
  productId: 'inventory_reports_phase1_sample_product',
  variantId: 'inventory_reports_phase1_sample_variant',
  units: {
    mass: 'inventory_reports_phase1_unit_mass',
    volume: 'inventory_reports_phase1_unit_volume',
    count: 'inventory_reports_phase1_unit_count',
  },
  materials: {
    beans: 'inventory_reports_phase1_material_beans',
    milk: 'inventory_reports_phase1_material_milk',
    pastry: 'inventory_reports_phase1_material_pastry',
  },
  batches: {
    beans: 'inventory_reports_phase1_batch_beans',
    milk: 'inventory_reports_phase1_batch_milk',
    pastry: 'inventory_reports_phase1_batch_pastry',
  },
  orders: {
    one: 'inventory_reports_phase1_order_1',
    two: 'inventory_reports_phase1_order_2',
    three: 'inventory_reports_phase1_order_3',
  },
  orderItem: 'inventory_reports_phase1_order_item_1',
  transactions: {
    checkout: 'inventory_reports_phase1_tx_checkout',
    waste: 'inventory_reports_phase1_tx_waste',
  },
  lines: {
    checkoutBeans: 'inventory_reports_phase1_line_checkout_beans',
    checkoutMilk: 'inventory_reports_phase1_line_checkout_milk',
    wasteMilk: 'inventory_reports_phase1_line_waste_milk',
    wastePastry: 'inventory_reports_phase1_line_waste_pastry',
  },
};

function decimal(value: string | number) {
  return new Prisma.Decimal(value);
}

async function main() {
  await prisma.user.upsert({
    where: { email: 'inventory-reports-phase1-sample@dev.local' },
    update: {
      id: SAMPLE.userId,
      username: 'inventory_reports_phase1_sample',
      firstName: 'Inventory',
      lastName: 'Sample',
      role: Role.ADMINISTRATOR,
      isActive: true,
    },
    create: {
      id: SAMPLE.userId,
      username: 'inventory_reports_phase1_sample',
      email: 'inventory-reports-phase1-sample@dev.local',
      passwordHash: 'sample-only-not-for-login',
      firstName: 'Inventory',
      lastName: 'Sample',
      role: Role.ADMINISTRATOR,
      isActive: true,
    },
  });

  await prisma.unit.upsert({
    where: { code: 'IRP1-MASS' },
    update: {
      id: SAMPLE.units.mass,
      name: 'Inventory Reports Phase 1 Mass',
      dimension: UnitDimension.MASS,
      conversionFactor: decimal('1'),
    },
    create: {
      id: SAMPLE.units.mass,
      code: 'IRP1-MASS',
      name: 'Inventory Reports Phase 1 Mass',
      dimension: UnitDimension.MASS,
      conversionFactor: decimal('1'),
    },
  });

  await prisma.unit.upsert({
    where: { code: 'IRP1-VOLUME' },
    update: {
      id: SAMPLE.units.volume,
      name: 'Inventory Reports Phase 1 Volume',
      dimension: UnitDimension.VOLUME,
      conversionFactor: decimal('1'),
    },
    create: {
      id: SAMPLE.units.volume,
      code: 'IRP1-VOLUME',
      name: 'Inventory Reports Phase 1 Volume',
      dimension: UnitDimension.VOLUME,
      conversionFactor: decimal('1'),
    },
  });

  await prisma.unit.upsert({
    where: { code: 'IRP1-COUNT' },
    update: {
      id: SAMPLE.units.count,
      name: 'Inventory Reports Phase 1 Count',
      dimension: UnitDimension.COUNT,
      conversionFactor: decimal('1'),
    },
    create: {
      id: SAMPLE.units.count,
      code: 'IRP1-COUNT',
      name: 'Inventory Reports Phase 1 Count',
      dimension: UnitDimension.COUNT,
      conversionFactor: decimal('1'),
    },
  });

  await prisma.category.upsert({
    where: { id: SAMPLE.categoryId },
    update: {
      name: 'Inventory Reports Validation',
      parentId: null,
      sortOrder: 0,
    },
    create: {
      id: SAMPLE.categoryId,
      name: 'Inventory Reports Validation',
      sortOrder: 0,
    },
  });

  await prisma.product.upsert({
    where: { id: SAMPLE.productId },
    update: {
      categoryId: SAMPLE.categoryId,
      name: 'Validation Latte',
      isEnabled: true,
    },
    create: {
      id: SAMPLE.productId,
      categoryId: SAMPLE.categoryId,
      name: 'Validation Latte',
      isEnabled: true,
    },
  });

  await prisma.productVariant.upsert({
    where: { sku: 'IRP1-LATTE-LARGE' },
    update: {
      id: SAMPLE.variantId,
      productId: SAMPLE.productId,
      name: 'Large',
      price: decimal('1000'),
      isEnabled: true,
    },
    create: {
      id: SAMPLE.variantId,
      productId: SAMPLE.productId,
      name: 'Large',
      sku: 'IRP1-LATTE-LARGE',
      price: decimal('1000'),
      isEnabled: true,
    },
  });

  await prisma.rawMaterial.upsert({
    where: { sku: 'IRP1-BEANS' },
    update: {
      id: SAMPLE.materials.beans,
      unitId: SAMPLE.units.mass,
      name: 'Inventory Reports Sample Coffee Beans',
      reorderPoint: decimal('5'),
      isActive: true,
    },
    create: {
      id: SAMPLE.materials.beans,
      unitId: SAMPLE.units.mass,
      name: 'Inventory Reports Sample Coffee Beans',
      sku: 'IRP1-BEANS',
      reorderPoint: decimal('5'),
      isActive: true,
    },
  });

  await prisma.rawMaterial.upsert({
    where: { sku: 'IRP1-MILK' },
    update: {
      id: SAMPLE.materials.milk,
      unitId: SAMPLE.units.volume,
      name: 'Inventory Reports Sample Milk',
      reorderPoint: decimal('4'),
      isActive: true,
    },
    create: {
      id: SAMPLE.materials.milk,
      unitId: SAMPLE.units.volume,
      name: 'Inventory Reports Sample Milk',
      sku: 'IRP1-MILK',
      reorderPoint: decimal('4'),
      isActive: true,
    },
  });

  await prisma.rawMaterial.upsert({
    where: { sku: 'IRP1-PASTRY' },
    update: {
      id: SAMPLE.materials.pastry,
      unitId: SAMPLE.units.count,
      name: 'Inventory Reports Sample Pastry',
      reorderPoint: decimal('2'),
      isActive: true,
    },
    create: {
      id: SAMPLE.materials.pastry,
      unitId: SAMPLE.units.count,
      name: 'Inventory Reports Sample Pastry',
      sku: 'IRP1-PASTRY',
      reorderPoint: decimal('2'),
      isActive: true,
    },
  });

  await prisma.stockBatch.upsert({
    where: { id: SAMPLE.batches.beans },
    update: {
      rawMaterialId: SAMPLE.materials.beans,
      initialQuantity: decimal('20'),
      remainingQuantity: decimal('18'),
      costPerUnit: decimal('100'),
      receivedAt: new Date('2036-03-31T08:00:00+08:00'),
      expirationDate: null,
    },
    create: {
      id: SAMPLE.batches.beans,
      rawMaterialId: SAMPLE.materials.beans,
      initialQuantity: decimal('20'),
      remainingQuantity: decimal('18'),
      costPerUnit: decimal('100'),
      receivedAt: new Date('2036-03-31T08:00:00+08:00'),
      expirationDate: null,
    },
  });

  await prisma.stockBatch.upsert({
    where: { id: SAMPLE.batches.milk },
    update: {
      rawMaterialId: SAMPLE.materials.milk,
      initialQuantity: decimal('20'),
      remainingQuantity: decimal('14'),
      costPerUnit: decimal('60'),
      receivedAt: new Date('2036-03-31T08:00:00+08:00'),
      expirationDate: null,
    },
    create: {
      id: SAMPLE.batches.milk,
      rawMaterialId: SAMPLE.materials.milk,
      initialQuantity: decimal('20'),
      remainingQuantity: decimal('14'),
      costPerUnit: decimal('60'),
      receivedAt: new Date('2026-03-31T08:00:00+08:00'),
      expirationDate: null,
    },
  });

  await prisma.stockBatch.upsert({
    where: { id: SAMPLE.batches.pastry },
    update: {
      rawMaterialId: SAMPLE.materials.pastry,
      initialQuantity: decimal('10'),
      remainingQuantity: decimal('8'),
      costPerUnit: decimal('70'),
      receivedAt: new Date('2026-03-31T08:00:00+08:00'),
      expirationDate: null,
    },
    create: {
      id: SAMPLE.batches.pastry,
      rawMaterialId: SAMPLE.materials.pastry,
      initialQuantity: decimal('10'),
      remainingQuantity: decimal('8'),
      costPerUnit: decimal('70'),
      receivedAt: new Date('2026-03-31T08:00:00+08:00'),
      expirationDate: null,
    },
  });

  await prisma.rawMaterialInventorySummary.upsert({
    where: { rawMaterialId: SAMPLE.materials.beans },
    update: {
      onHandQuantity: decimal('18'),
      usableQuantity: decimal('18'),
      nearestExpiryDate: null,
      activeBatchCount: 1,
    },
    create: {
      rawMaterialId: SAMPLE.materials.beans,
      onHandQuantity: decimal('18'),
      usableQuantity: decimal('18'),
      nearestExpiryDate: null,
      activeBatchCount: 1,
    },
  });

  await prisma.rawMaterialInventorySummary.upsert({
    where: { rawMaterialId: SAMPLE.materials.milk },
    update: {
      onHandQuantity: decimal('14'),
      usableQuantity: decimal('14'),
      nearestExpiryDate: null,
      activeBatchCount: 1,
    },
    create: {
      rawMaterialId: SAMPLE.materials.milk,
      onHandQuantity: decimal('14'),
      usableQuantity: decimal('14'),
      nearestExpiryDate: null,
      activeBatchCount: 1,
    },
  });

  await prisma.rawMaterialInventorySummary.upsert({
    where: { rawMaterialId: SAMPLE.materials.pastry },
    update: {
      onHandQuantity: decimal('8'),
      usableQuantity: decimal('8'),
      nearestExpiryDate: null,
      activeBatchCount: 1,
    },
    create: {
      rawMaterialId: SAMPLE.materials.pastry,
      onHandQuantity: decimal('8'),
      usableQuantity: decimal('8'),
      nearestExpiryDate: null,
      activeBatchCount: 1,
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.one },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase1-order-1',
      subtotalAmount: decimal('1000'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1000'),
      totalCogsAmount: decimal('400'),
      completedAt: new Date('2036-04-01T10:00:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.one,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase1-order-1',
      subtotalAmount: decimal('1000'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1000'),
      totalCogsAmount: decimal('400'),
      completedAt: new Date('2036-04-01T10:00:00+08:00'),
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.two },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase1-order-2',
      subtotalAmount: decimal('1500'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1500'),
      totalCogsAmount: decimal('600'),
      completedAt: new Date('2036-04-01T14:00:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.two,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase1-order-2',
      subtotalAmount: decimal('1500'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1500'),
      totalCogsAmount: decimal('600'),
      completedAt: new Date('2036-04-01T14:00:00+08:00'),
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.three },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase1-order-3',
      subtotalAmount: decimal('800'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('800'),
      totalCogsAmount: decimal('300'),
      completedAt: new Date('2036-04-02T11:00:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.three,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase1-order-3',
      subtotalAmount: decimal('800'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('800'),
      totalCogsAmount: decimal('300'),
      completedAt: new Date('2036-04-02T11:00:00+08:00'),
    },
  });

  await prisma.orderItem.upsert({
    where: { id: SAMPLE.orderItem },
    update: {
      orderId: SAMPLE.orders.one,
      productVariantId: SAMPLE.variantId,
      quantity: 1,
      unitBasePrice: decimal('1000'),
      unitModifierAmount: decimal('0'),
      unitFinalPrice: decimal('1000'),
      lineSubtotal: decimal('1000'),
      unitCogsAmount: decimal('400'),
      lineCogsAmount: decimal('400'),
      note: 'Inventory Reports Phase 1 sample item',
      productNameSnapshot: 'Validation Latte',
      variantNameSnapshot: 'Large',
      skuSnapshot: 'IRP1-LATTE-LARGE',
    },
    create: {
      id: SAMPLE.orderItem,
      orderId: SAMPLE.orders.one,
      productVariantId: SAMPLE.variantId,
      quantity: 1,
      unitBasePrice: decimal('1000'),
      unitModifierAmount: decimal('0'),
      unitFinalPrice: decimal('1000'),
      lineSubtotal: decimal('1000'),
      unitCogsAmount: decimal('400'),
      lineCogsAmount: decimal('400'),
      note: 'Inventory Reports Phase 1 sample item',
      productNameSnapshot: 'Validation Latte',
      variantNameSnapshot: 'Large',
      skuSnapshot: 'IRP1-LATTE-LARGE',
    },
  });

  await prisma.inventoryTransaction.upsert({
    where: { id: SAMPLE.transactions.checkout },
    update: {
      type: InventoryTransactionType.CHECKOUT,
      sourceType: InventorySourceType.ORDER,
      sourceId: SAMPLE.orders.one,
      actorUserId: SAMPLE.userId,
      note: 'Inventory Reports Phase 1 sample checkout transaction',
      occurredAt: new Date('2036-04-01T12:00:00+08:00'),
    },
    create: {
      id: SAMPLE.transactions.checkout,
      type: InventoryTransactionType.CHECKOUT,
      sourceType: InventorySourceType.ORDER,
      sourceId: SAMPLE.orders.one,
      actorUserId: SAMPLE.userId,
      note: 'Inventory Reports Phase 1 sample checkout transaction',
      occurredAt: new Date('2036-04-01T12:00:00+08:00'),
    },
  });

  await prisma.inventoryTransaction.upsert({
    where: { id: SAMPLE.transactions.waste },
    update: {
      type: InventoryTransactionType.WASTE,
      sourceType: InventorySourceType.WASTE,
      sourceId: 'inventory_reports_phase1_waste_record',
      actorUserId: SAMPLE.userId,
      note: 'Inventory Reports Phase 1 sample waste transaction',
      reasonCode: 'SPOILAGE',
      occurredAt: new Date('2036-04-01T18:00:00+08:00'),
    },
    create: {
      id: SAMPLE.transactions.waste,
      type: InventoryTransactionType.WASTE,
      sourceType: InventorySourceType.WASTE,
      sourceId: 'inventory_reports_phase1_waste_record',
      actorUserId: SAMPLE.userId,
      note: 'Inventory Reports Phase 1 sample waste transaction',
      reasonCode: 'SPOILAGE',
      occurredAt: new Date('2036-04-01T18:00:00+08:00'),
    },
  });

  await prisma.inventoryTransactionLine.upsert({
    where: { id: SAMPLE.lines.checkoutBeans },
    update: {
      inventoryTransactionId: SAMPLE.transactions.checkout,
      rawMaterialId: SAMPLE.materials.beans,
      stockBatchId: SAMPLE.batches.beans,
      productVariantId: SAMPLE.variantId,
      orderItemId: SAMPLE.orderItem,
      quantityDelta: decimal('-2'),
      unitCostSnapshot: decimal('100'),
      totalCostDelta: decimal('-200'),
    },
    create: {
      id: SAMPLE.lines.checkoutBeans,
      inventoryTransactionId: SAMPLE.transactions.checkout,
      rawMaterialId: SAMPLE.materials.beans,
      stockBatchId: SAMPLE.batches.beans,
      productVariantId: SAMPLE.variantId,
      orderItemId: SAMPLE.orderItem,
      quantityDelta: decimal('-2'),
      unitCostSnapshot: decimal('100'),
      totalCostDelta: decimal('-200'),
    },
  });

  await prisma.inventoryTransactionLine.upsert({
    where: { id: SAMPLE.lines.checkoutMilk },
    update: {
      inventoryTransactionId: SAMPLE.transactions.checkout,
      rawMaterialId: SAMPLE.materials.milk,
      stockBatchId: SAMPLE.batches.milk,
      productVariantId: SAMPLE.variantId,
      orderItemId: SAMPLE.orderItem,
      quantityDelta: decimal('-5'),
      unitCostSnapshot: decimal('60'),
      totalCostDelta: decimal('-300'),
    },
    create: {
      id: SAMPLE.lines.checkoutMilk,
      inventoryTransactionId: SAMPLE.transactions.checkout,
      rawMaterialId: SAMPLE.materials.milk,
      stockBatchId: SAMPLE.batches.milk,
      productVariantId: SAMPLE.variantId,
      orderItemId: SAMPLE.orderItem,
      quantityDelta: decimal('-5'),
      unitCostSnapshot: decimal('60'),
      totalCostDelta: decimal('-300'),
    },
  });

  await prisma.inventoryTransactionLine.upsert({
    where: { id: SAMPLE.lines.wasteMilk },
    update: {
      inventoryTransactionId: SAMPLE.transactions.waste,
      rawMaterialId: SAMPLE.materials.milk,
      stockBatchId: SAMPLE.batches.milk,
      quantityDelta: decimal('-1'),
      unitCostSnapshot: decimal('60'),
      totalCostDelta: decimal('-60'),
    },
    create: {
      id: SAMPLE.lines.wasteMilk,
      inventoryTransactionId: SAMPLE.transactions.waste,
      rawMaterialId: SAMPLE.materials.milk,
      stockBatchId: SAMPLE.batches.milk,
      quantityDelta: decimal('-1'),
      unitCostSnapshot: decimal('60'),
      totalCostDelta: decimal('-60'),
    },
  });

  await prisma.inventoryTransactionLine.upsert({
    where: { id: SAMPLE.lines.wastePastry },
    update: {
      inventoryTransactionId: SAMPLE.transactions.waste,
      rawMaterialId: SAMPLE.materials.pastry,
      stockBatchId: SAMPLE.batches.pastry,
      quantityDelta: decimal('-2'),
      unitCostSnapshot: decimal('70'),
      totalCostDelta: decimal('-140'),
    },
    create: {
      id: SAMPLE.lines.wastePastry,
      inventoryTransactionId: SAMPLE.transactions.waste,
      rawMaterialId: SAMPLE.materials.pastry,
      stockBatchId: SAMPLE.batches.pastry,
      quantityDelta: decimal('-2'),
      unitCostSnapshot: decimal('70'),
      totalCostDelta: decimal('-140'),
    },
  });

  console.log('Inventory Reports Phase 1 sample data is ready.');
  console.log('Expected Food Cost %: 39.39%');
  console.log('Expected Waste %: 28.57%');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
