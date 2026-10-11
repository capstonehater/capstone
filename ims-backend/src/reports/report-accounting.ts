import { Prisma } from '@prisma/client';
import { sumDecimals } from '../common/utils/decimal.util';

export type SalesAmounts = {
  subtotalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  taxAmount?: Prisma.Decimal;
  refunds?: Prisma.Decimal;
  cogs?: Prisma.Decimal;
  collectedAmount?: Prisma.Decimal;
  transactionCount?: number;
};

// SQL report rows already contain tax-exclusive, signed sale/reversal amounts.
export function summarizeSales(rows: SalesAmounts[]) {
  const zero = new Prisma.Decimal(0);
  const grossSales = sumDecimals(rows.map((row) => row.subtotalAmount));
  const discounts = sumDecimals(rows.map((row) => row.discountAmount));
  const refunds = sumDecimals(rows.map((row) => row.refunds ?? zero));
  const netSales = sumDecimals(rows.map((row) => row.totalAmount));
  const taxes = sumDecimals(rows.map((row) => row.taxAmount ?? zero));
  const cogs = sumDecimals(rows.map((row) => row.cogs ?? zero));
  const transactionCount = rows.reduce(
    (sum, row) => sum + (row.transactionCount ?? 1),
    0,
  );
  return {
    grossSales,
    discounts,
    refunds,
    netSales,
    taxes,
    cogs,
    grossMargin: netSales.minus(cogs),
    collectedAmount: sumDecimals(
      rows.map(
        (row) =>
          row.collectedAmount ?? row.totalAmount.plus(row.taxAmount ?? zero),
      ),
    ),
    transactionCount,
    averageOrderValue:
      transactionCount > 0 ? netSales.dividedBy(transactionCount) : zero,
  };
}

export function groupMaterialQuantities(
  materials: Array<{
    rawMaterial: { unit: { code: string } };
    consumedQuantity: Prisma.Decimal;
  }>,
) {
  const groups = new Map<string, Prisma.Decimal>();
  for (const material of materials) {
    const unit = material.rawMaterial.unit.code;
    groups.set(
      unit,
      (groups.get(unit) ?? new Prisma.Decimal(0)).plus(
        material.consumedQuantity,
      ),
    );
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unit, quantity]) => ({ unit, quantity }));
}

// Allocate discounts and VAT proportionally, distributing rounding cents in a
// stable item order so displayed product revenue adds up to the order revenue.
export function itemNetRevenue(
  itemId: string,
  order: {
    subtotalAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    items: Array<{ id: string; lineSubtotal: Prisma.Decimal }>;
  },
) {
  if (!order.subtotalAmount.greaterThan(0)) return new Prisma.Decimal(0);
  const net = order.totalAmount.minus(order.taxAmount);
  let cumulative = new Prisma.Decimal(0);
  for (const item of [...order.items].sort((a, b) =>
    a.id.localeCompare(b.id),
  )) {
    const previous = cumulative;
    cumulative = cumulative.plus(item.lineSubtotal);
    if (item.id === itemId) {
      return net
        .mul(cumulative)
        .dividedBy(order.subtotalAmount)
        .toDecimalPlaces(2)
        .minus(
          net.mul(previous).dividedBy(order.subtotalAmount).toDecimalPlaces(2),
        );
    }
  }
  return new Prisma.Decimal(0);
}
