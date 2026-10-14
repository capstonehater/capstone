import { Prisma, UnitDimension } from '@prisma/client';

type HistoricalMaterial = {
  id: string;
  name: string;
  sku: string;
  reorderPoint: Prisma.Decimal;
  isActive: boolean;
  summary: null;
  unit: {
    id: string;
    code: string;
    name: string;
    dimension: UnitDimension;
    conversionFactor: Prisma.Decimal;
  };
};

function snapshotText(value: Prisma.JsonValue | undefined): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Deleted material has an invalid historical snapshot');
  }
  return String(value);
}

export function materialFromSnapshot(
  snapshot: Prisma.JsonValue | null,
): HistoricalMaterial {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Deleted material is missing its historical snapshot');
  }
  const unit = snapshot.unit;
  if (!unit || typeof unit !== 'object' || Array.isArray(unit)) {
    throw new Error('Deleted material is missing its historical unit');
  }
  return {
    id: snapshotText(snapshot.id),
    name: snapshotText(snapshot.name),
    sku: snapshotText(snapshot.sku),
    reorderPoint: new Prisma.Decimal(snapshotText(snapshot.reorderPoint)),
    isActive: false,
    summary: null,
    unit: {
      id: snapshotText(unit.id),
      code: snapshotText(unit.code),
      name: snapshotText(unit.name),
      dimension: unit.dimension as UnitDimension,
      conversionFactor: new Prisma.Decimal(snapshotText(unit.conversionFactor)),
    },
  };
}

export function withHistoricalMaterial<
  T extends {
    rawMaterialId: string | null;
    rawMaterialSnapshot?: Prisma.JsonValue | null;
    rawMaterial: unknown;
  },
>(
  record: T,
): Omit<T, 'rawMaterialId' | 'rawMaterial'> & {
  rawMaterialId: string;
  rawMaterial: NonNullable<T['rawMaterial']> | HistoricalMaterial;
} {
  const rawMaterial =
    record.rawMaterial ??
    materialFromSnapshot(record.rawMaterialSnapshot ?? null);
  return {
    ...record,
    rawMaterialId:
      record.rawMaterialId ?? (rawMaterial as HistoricalMaterial).id,
    rawMaterial: rawMaterial as
      | NonNullable<T['rawMaterial']>
      | HistoricalMaterial,
  };
}
