import { Prisma } from '@prisma/client';
import {
  groupMaterialQuantities,
  itemNetRevenue,
  summarizeSales,
} from './report-accounting';

const decimal = (value: string | number) => new Prisma.Decimal(value);

describe('report accounting reconciliation', () => {
  it('separates net sales, VAT, COGS and profit, including a refund in a later period', () => {
    const sale = {
      subtotalAmount: decimal(1000),
      discountAmount: decimal(100),
      totalAmount: decimal(900),
      taxAmount: decimal(108),
      collectedAmount: decimal(1008),
      cogs: decimal(300),
      transactionCount: 1,
    };
    const refund = {
      subtotalAmount: decimal(0),
      discountAmount: decimal(0),
      totalAmount: decimal(-900),
      taxAmount: decimal(-108),
      collectedAmount: decimal(-1008),
      refunds: decimal(900),
      cogs: decimal(-300),
      transactionCount: 0,
    };
    expect(summarizeSales([sale]).grossMargin.toString()).toBe('600');
    const refunded = summarizeSales([refund]);
    expect(refunded.netSales.toString()).toBe('-900');
    expect(refunded.taxes.toString()).toBe('-108');
    const both = summarizeSales([sale, refund]);
    expect(both.netSales.toString()).toBe('0');
    expect(both.grossMargin.toString()).toBe('0');
    expect(both.collectedAmount.toString()).toBe('0');
    expect(
      both.grossSales
        .minus(both.discounts)
        .minus(both.refunds)
        .equals(both.netSales),
    ).toBe(true);
  });

  it('distributes cents across items so product revenue reconciles exactly', () => {
    const order = {
      subtotalAmount: decimal('0.05'),
      totalAmount: decimal('0.04'),
      taxAmount: decimal(0),
      items: [
        { id: 'a', lineSubtotal: decimal('0.02') },
        { id: 'b', lineSubtotal: decimal('0.02') },
        { id: 'c', lineSubtotal: decimal('0.01') },
      ],
    };
    expect(
      order.items.map((item) => itemNetRevenue(item.id, order).toString()),
    ).toEqual(['0.02', '0.01', '0.01']);
    expect(
      itemNetRevenue('a', { ...order, totalAmount: decimal(0) }).toString(),
    ).toBe('0');
  });

  it('never adds mass, volume and pieces into one material quantity', () => {
    const groups = groupMaterialQuantities([
      {
        rawMaterial: { unit: { code: 'g' } },
        consumedQuantity: decimal('100.1'),
      },
      {
        rawMaterial: { unit: { code: 'g' } },
        consumedQuantity: decimal('0.2'),
      },
      { rawMaterial: { unit: { code: 'ml' } }, consumedQuantity: decimal(250) },
      { rawMaterial: { unit: { code: 'pcs' } }, consumedQuantity: decimal(3) },
      { rawMaterial: { unit: { code: 'g' } }, consumedQuantity: decimal(-10) },
    ]);
    expect(
      groups.map((group) => [group.unit, group.quantity.toString()]),
    ).toEqual([
      ['g', '90.3'],
      ['ml', '250'],
      ['pcs', '3'],
    ]);
  });

  it('returns zero totals for an empty period without dividing by zero', () => {
    expect(summarizeSales([]).averageOrderValue.toString()).toBe('0');
    expect(groupMaterialQuantities([])).toEqual([]);
  });
});
