import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { sumDecimals, toDecimal } from '../common/utils/decimal.util';
import { ValidatedModifierSelection } from '../recipes/modifier-validation.service';

@Injectable()
export class PricingService {
  calculateUnitModifierAmount(
    modifiers: ValidatedModifierSelection[],
  ): Prisma.Decimal {
    return sumDecimals(
      modifiers.map((modifier) =>
        modifier.unitPriceAdjustment.mul(modifier.quantity),
      ),
    );
  }

  calculateOrderDiscount(
    subtotalAmount: Prisma.Decimal,
    discountRate?: number,
  ): Prisma.Decimal {
    const normalizedRate = toDecimal(discountRate ?? 0);
    return subtotalAmount.mul(normalizedRate);
  }

  calculateIncludedTax(totalAmount: Prisma.Decimal): Prisma.Decimal {
    if (totalAmount.lessThanOrEqualTo(0)) {
      return new Prisma.Decimal(0);
    }

    return totalAmount.minus(totalAmount.dividedBy('1.12'));
  }
}
