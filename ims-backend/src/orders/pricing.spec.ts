import { Prisma } from '@prisma/client';
import { PricingService } from './pricing.service';

describe('checkout currency precision', () => {
  const pricing = new PricingService();
  it('extracts included VAT instead of adding VAT to the customer total', () => {
    expect(
      pricing.calculateIncludedTax(new Prisma.Decimal(1008)).toString(),
    ).toBe('108');
  });
  it('rounds the discount and VAT to the same cents that are persisted', () => {
    expect(
      pricing
        .calculateOrderDiscount(new Prisma.Decimal('19.99'), 0.15)
        .toString(),
    ).toBe('3');
    expect(
      pricing.calculateIncludedTax(new Prisma.Decimal('16.99')).toString(),
    ).toBe('1.82');
    expect(pricing.calculateIncludedTax(new Prisma.Decimal(0)).toString()).toBe(
      '0',
    );
  });
});
