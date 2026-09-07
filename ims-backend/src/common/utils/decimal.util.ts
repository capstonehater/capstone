import { Prisma } from '@prisma/client';

export function toDecimal(
  value: Prisma.Decimal | string | number | null | undefined,
): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  if (value === null || value === undefined) {
    return new Prisma.Decimal(0);
  }

  return new Prisma.Decimal(value);
}

export function sumDecimals(
  values: Array<Prisma.Decimal | string | number | null | undefined>,
): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (total, value) => total.plus(toDecimal(value)),
    new Prisma.Decimal(0),
  );
}

export function minDecimal(
  left: Prisma.Decimal | string | number,
  right: Prisma.Decimal | string | number,
): Prisma.Decimal {
  const leftDecimal = toDecimal(left);
  const rightDecimal = toDecimal(right);

  return leftDecimal.lessThan(rightDecimal) ? leftDecimal : rightDecimal;
}

export function isPositiveDecimal(
  value: Prisma.Decimal | string | number | null | undefined,
): boolean {
  return toDecimal(value).greaterThan(0);
}

export function floorDecimalToInt(
  value: Prisma.Decimal | string | number | null | undefined,
): number {
  return Math.floor(toDecimal(value).toNumber());
}
