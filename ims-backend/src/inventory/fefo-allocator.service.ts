import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getBusinessDate } from '../common/utils/date.util';
import { minDecimal, toDecimal } from '../common/utils/decimal.util';

type TxClient = Prisma.TransactionClient;

export type MaterialRequirement = {
  rawMaterialId: string;
  quantity: Prisma.Decimal;
  orderItemId?: string;
  productVariantId?: string;
};

export type MaterialAllocation = {
  rawMaterialId: string;
  stockBatchId: string;
  orderItemId?: string;
  productVariantId?: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  totalCost: Prisma.Decimal;
};

type LockedBatchRow = {
  id: string;
  raw_material_id: string;
  remaining_quantity: Prisma.Decimal;
  cost_per_unit: Prisma.Decimal;
  expiration_date: Date | null;
  received_at: Date;
};

type MutableLockedBatch = {
  id: string;
  rawMaterialId: string;
  remainingQuantity: Prisma.Decimal;
  costPerUnit: Prisma.Decimal;
};

@Injectable()
export class FEFOAllocator {
  constructor(private readonly prisma: PrismaService) {}

  async allocateAndConsume(
    tx: TxClient,
    requirements: MaterialRequirement[],
  ): Promise<MaterialAllocation[]> {
    const normalizedRequirements = requirements.filter((requirement) =>
      toDecimal(requirement.quantity).greaterThan(0),
    );

    if (normalizedRequirements.length === 0) {
      return [];
    }

    const rawMaterialIds = [
      ...new Set(
        normalizedRequirements.map((requirement) => requirement.rawMaterialId),
      ),
    ];

    const businessDate = getBusinessDate();
    const lockedBatches = await tx.$queryRaw<LockedBatchRow[]>(Prisma.sql`
      SELECT
        id,
        raw_material_id,
        remaining_quantity,
        cost_per_unit,
        expiration_date,
        received_at
      FROM stock_batches
      WHERE
        raw_material_id IN (${Prisma.join(rawMaterialIds)})
        AND remaining_quantity > 0
        AND (expiration_date IS NULL OR expiration_date >= ${businessDate})
      ORDER BY expiration_date ASC NULLS LAST, received_at ASC, id ASC
      FOR UPDATE
    `);

    const batchesByMaterial = new Map<string, MutableLockedBatch[]>();
    for (const batch of lockedBatches) {
      const existing = batchesByMaterial.get(batch.raw_material_id) ?? [];
      existing.push({
        id: batch.id,
        rawMaterialId: batch.raw_material_id,
        remainingQuantity: toDecimal(batch.remaining_quantity),
        costPerUnit: toDecimal(batch.cost_per_unit),
      });
      batchesByMaterial.set(batch.raw_material_id, existing);
    }

    const allocations: MaterialAllocation[] = [];

    for (const requirement of normalizedRequirements) {
      const materialBatches =
        batchesByMaterial.get(requirement.rawMaterialId) ?? [];

      let remainingNeed = toDecimal(requirement.quantity);

      for (const batch of materialBatches) {
        if (remainingNeed.lessThanOrEqualTo(0)) {
          break;
        }

        if (batch.remainingQuantity.lessThanOrEqualTo(0)) {
          continue;
        }

        const consumedQuantity = minDecimal(
          batch.remainingQuantity,
          remainingNeed,
        );
        batch.remainingQuantity =
          batch.remainingQuantity.minus(consumedQuantity);
        remainingNeed = remainingNeed.minus(consumedQuantity);

        allocations.push({
          rawMaterialId: requirement.rawMaterialId,
          stockBatchId: batch.id,
          orderItemId: requirement.orderItemId,
          productVariantId: requirement.productVariantId,
          quantity: consumedQuantity,
          unitCost: batch.costPerUnit,
          totalCost: batch.costPerUnit.mul(consumedQuantity),
        });
      }

      if (remainingNeed.greaterThan(0)) {
        throw new ConflictException(
          `Insufficient stock for raw material ${requirement.rawMaterialId}`,
        );
      }
    }

    const finalRemainingByBatch = new Map<string, Prisma.Decimal>();
    for (const materialBatches of batchesByMaterial.values()) {
      for (const batch of materialBatches) {
        finalRemainingByBatch.set(batch.id, batch.remainingQuantity);
      }
    }

    for (const [
      stockBatchId,
      remainingQuantity,
    ] of finalRemainingByBatch.entries()) {
      await tx.stockBatch.update({
        where: { id: stockBatchId },
        data: {
          remainingQuantity,
        },
      });
    }

    return allocations;
  }
}
