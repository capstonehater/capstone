import { Injectable } from '@nestjs/common';
import {
  InventorySourceType,
  InventoryTransactionType,
  Prisma,
} from '@prisma/client';

type TxClient = Prisma.TransactionClient;

type LedgerLineInput = {
  rawMaterialId: string;
  stockBatchId: string;
  quantityDelta: Prisma.Decimal;
  unitCostSnapshot: Prisma.Decimal;
  totalCostDelta: Prisma.Decimal;
  productVariantId?: string;
  orderItemId?: string;
};

type AppendTransactionInput = {
  type: InventoryTransactionType;
  sourceType: InventorySourceType;
  sourceId?: string;
  actorUserId?: string | null;
  reasonCode?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  note?: string | null;
  occurredAt?: Date;
  lines: LedgerLineInput[];
};

@Injectable()
export class InventoryLedgerService {
  async appendTransaction(tx: TxClient, input: AppendTransactionInput) {
    const transaction = await tx.inventoryTransaction.create({
      data: {
        type: input.type,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        actorUserId: input.actorUserId ?? null,
        reasonCode: input.reasonCode ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
        note: input.note ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });

    if (input.lines.length > 0) {
      await tx.inventoryTransactionLine.createMany({
        data: input.lines.map((line) => ({
          inventoryTransactionId: transaction.id,
          rawMaterialId: line.rawMaterialId,
          stockBatchId: line.stockBatchId,
          productVariantId: line.productVariantId ?? null,
          orderItemId: line.orderItemId ?? null,
          quantityDelta: line.quantityDelta,
          unitCostSnapshot: line.unitCostSnapshot,
          totalCostDelta: line.totalCostDelta,
        })),
      });
    }

    return transaction;
  }
}
