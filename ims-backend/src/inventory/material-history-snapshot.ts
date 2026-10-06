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

export function materialFromSnapshot(snapshot: Prisma.JsonValue | null): HistoricalMaterial {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw new Error('Deleted material is missing its historical snapshot');
  }
  const unit = snapshot.unit as Prisma.JsonObject;
  return {
    id: String(snapshot.id),
    name: String(snapshot.name),
    sku: String(snapshot.sku),
    reorderPoint: new Prisma.Decimal(String(snapshot.reorderPoint)),
    isActive: false,
    summary: null,
    unit: {
      id: String(unit.id),
      code: String(unit.code),
      name: String(unit.name),
      dimension: unit.dimension as UnitDimension,
      conversionFactor: new Prisma.Decimal(String(unit.conversionFactor)),
    },
  };
}

export function withHistoricalMaterial<T extends {
  rawMaterialId: string | null;
  rawMaterialSnapshot?: Prisma.JsonValue | null;
  rawMaterial: unknown;
}>(record: T): Omit<T, 'rawMaterialId' | 'rawMaterial'> & {
  rawMaterialId: string;
  rawMaterial: NonNullable<T['rawMaterial']> | HistoricalMaterial;
} {
  const rawMaterial = record.rawMaterial ?? materialFromSnapshot(record.rawMaterialSnapshot ?? null);
  return {
    ...record,
    rawMaterialId: record.rawMaterialId ?? (rawMaterial as HistoricalMaterial).id,
    rawMaterial: rawMaterial as NonNullable<T['rawMaterial']> | HistoricalMaterial,
  };
}
