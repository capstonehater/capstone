import {
  OrderStatus,
  Prisma,
  PrismaClient,
  Role,
  UnitDimension,
} from '@prisma/client';

const prisma = new PrismaClient();

const SAMPLE = {
  userId: 'inventory_reports_phase3_sample_user',
  units: {
    mass: 'inventory_reports_phase3_unit_mass',
  },
  materials: {
    flour: 'inventory_reports_phase3_material_flour',
    sugar: 'inventory_reports_phase3_material_sugar',
  },
  orders: {
    one: 'inventory_reports_phase3_order_1',
    two: 'inventory_reports_phase3_order_2',
    three: 'inventory_reports_phase3_order_3',
  },
};

function decimal(value: string | number) {
  return new Prisma.Decimal(value);
}

function snapshotDate(value: string) {
  return new Date(`${value}T00:00:00.000+08:00`);
}

async function main() {
  await prisma.user.upsert({
    where: { email: 'inventory-reports-phase3-sample@dev.local' },
    update: {
      id: SAMPLE.userId,
      username: 'inventory_reports_phase3_sample',
      firstName: 'Inventory',
      lastName: 'Phase3',
      role: Role.ADMINISTRATOR,
      isActive: false,
      accountStatus: 'INACTIVE',
    },
    create: {
      id: SAMPLE.userId,
      username: 'inventory_reports_phase3_sample',
      email: 'inventory-reports-phase3-sample@dev.local',
      passwordHash: 'sample-only-not-for-login',
      firstName: 'Inventory',
      lastName: 'Phase3',
      role: Role.ADMINISTRATOR,
      isActive: false,
      accountStatus: 'INACTIVE',
    },
  });

  await prisma.unit.upsert({
    where: { code: 'IRP3-MASS' },
    update: {
      id: SAMPLE.units.mass,
      name: 'Inventory Reports Phase 3 Mass',
      dimension: UnitDimension.MASS,
      conversionFactor: decimal('1'),
    },
    create: {
      id: SAMPLE.units.mass,
      code: 'IRP3-MASS',
      name: 'Inventory Reports Phase 3 Mass',
      dimension: UnitDimension.MASS,
      conversionFactor: decimal('1'),
    },
  });

  await prisma.rawMaterial.upsert({
    where: { sku: 'IRP3-FLOUR' },
    update: {
      id: SAMPLE.materials.flour,
      unitId: SAMPLE.units.mass,
      name: 'Inventory Reports Phase 3 Flour',
      reorderPoint: decimal('10'),
      isActive: true,
    },
    create: {
      id: SAMPLE.materials.flour,
      unitId: SAMPLE.units.mass,
      name: 'Inventory Reports Phase 3 Flour',
      sku: 'IRP3-FLOUR',
      reorderPoint: decimal('10'),
      isActive: true,
    },
  });

  await prisma.rawMaterial.upsert({
    where: { sku: 'IRP3-SUGAR' },
    update: {
      id: SAMPLE.materials.sugar,
      unitId: SAMPLE.units.mass,
      name: 'Inventory Reports Phase 3 Sugar',
      reorderPoint: decimal('8'),
      isActive: true,
    },
    create: {
      id: SAMPLE.materials.sugar,
      unitId: SAMPLE.units.mass,
      name: 'Inventory Reports Phase 3 Sugar',
      sku: 'IRP3-SUGAR',
      reorderPoint: decimal('8'),
      isActive: true,
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.one },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase3-order-1',
      subtotalAmount: decimal('1800'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1800'),
      totalCogsAmount: decimal('1000'),
      completedAt: new Date('2036-06-01T09:00:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.one,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase3-order-1',
      subtotalAmount: decimal('1800'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1800'),
      totalCogsAmount: decimal('1000'),
      completedAt: new Date('2036-06-01T09:00:00+08:00'),
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.two },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase3-order-2',
      subtotalAmount: decimal('1400'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1400'),
      totalCogsAmount: decimal('700'),
      completedAt: new Date('2036-06-02T11:30:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.two,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase3-order-2',
      subtotalAmount: decimal('1400'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1400'),
      totalCogsAmount: decimal('700'),
      completedAt: new Date('2036-06-02T11:30:00+08:00'),
    },
  });

  await prisma.order.upsert({
    where: { id: SAMPLE.orders.three },
    update: {
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase3-order-3',
      subtotalAmount: decimal('1600'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1600'),
      totalCogsAmount: decimal('800'),
      completedAt: new Date('2036-06-03T16:45:00+08:00'),
    },
    create: {
      id: SAMPLE.orders.three,
      status: OrderStatus.COMPLETED,
      createdByUserId: SAMPLE.userId,
      idempotencyKey: 'inventory-reports-phase3-order-3',
      subtotalAmount: decimal('1600'),
      discountRate: decimal('0'),
      discountAmount: decimal('0'),
      taxAmount: decimal('0'),
      totalAmount: decimal('1600'),
      totalCogsAmount: decimal('800'),
      completedAt: new Date('2036-06-03T16:45:00+08:00'),
    },
  });

  const snapshots = [
    {
      snapshotDate: snapshotDate('2036-06-01'),
      rawMaterialId: SAMPLE.materials.flour,
      onHandQuantity: decimal('60'),
      usableQuantity: decimal('60'),
      inventoryValue: decimal('600'),
    },
    {
      snapshotDate: snapshotDate('2036-06-01'),
      rawMaterialId: SAMPLE.materials.sugar,
      onHandQuantity: decimal('40'),
      usableQuantity: decimal('40'),
      inventoryValue: decimal('400'),
    },
    {
      snapshotDate: snapshotDate('2036-06-02'),
      rawMaterialId: SAMPLE.materials.flour,
      onHandQuantity: decimal('50'),
      usableQuantity: decimal('50'),
      inventoryValue: decimal('500'),
    },
    {
      snapshotDate: snapshotDate('2036-06-02'),
      rawMaterialId: SAMPLE.materials.sugar,
      onHandQuantity: decimal('30'),
      usableQuantity: decimal('30'),
      inventoryValue: decimal('300'),
    },
    {
      snapshotDate: snapshotDate('2036-06-03'),
      rawMaterialId: SAMPLE.materials.flour,
      onHandQuantity: decimal('70'),
      usableQuantity: decimal('70'),
      inventoryValue: decimal('700'),
    },
    {
      snapshotDate: snapshotDate('2036-06-03'),
      rawMaterialId: SAMPLE.materials.sugar,
      onHandQuantity: decimal('50'),
      usableQuantity: decimal('50'),
      inventoryValue: decimal('500'),
    },
  ];

  for (const row of snapshots) {
    await prisma.inventoryDailySnapshot.upsert({
      where: {
        snapshotDate_rawMaterialId: {
          snapshotDate: row.snapshotDate,
          rawMaterialId: row.rawMaterialId,
        },
      },
      update: row,
      create: row,
    });
  }

  console.log('Inventory Reports Phase 3 sample data is ready.');
  console.log('Expected daily inventory totals: 1000, 800, 1200. Average inventory = 1000.');
  console.log('Expected total COGS = 2500. Expected turnover for 2036-06-01 to 2036-06-03 = 2.50.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
