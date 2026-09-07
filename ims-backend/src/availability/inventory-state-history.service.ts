import { Injectable } from '@nestjs/common';
import {
  AvailabilityBlockingReason,
  Prisma,
  StockoutEntityType,
} from '@prisma/client';

type TxClient = Prisma.TransactionClient;

type RawMaterialStockoutState = {
  rawMaterialId: string;
  isActive: boolean;
  previousUsableQuantity: Prisma.Decimal | null;
  nextUsableQuantity: Prisma.Decimal;
};

type VariantAvailabilityTransition = {
  productVariantId: string;
  previousIsSellable: boolean | null;
  previousBlockingReason: AvailabilityBlockingReason | null;
  newIsSellable: boolean;
  newBlockingReason: AvailabilityBlockingReason;
  availableBaseQty: number;
};

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class InventoryStateHistoryService {
  async syncRawMaterialStockoutEvents(
    tx: TxClient,
    states: RawMaterialStockoutState[],
    occurredAt: Date,
  ) {
    if (states.length === 0) {
      return;
    }

    const rawMaterialIds = states.map((state) => state.rawMaterialId);
    const openEvents = await tx.stockoutEvent.findMany({
      where: {
        entityType: StockoutEntityType.RAW_MATERIAL,
        rawMaterialId: {
          in: rawMaterialIds,
        },
        endedAt: null,
      },
      select: {
        id: true,
        rawMaterialId: true,
      },
    });

    const openEventIdsByMaterialId = new Map(
      openEvents
        .filter(
          (event): event is typeof event & { rawMaterialId: string } =>
            !!event.rawMaterialId,
        )
        .map((event) => [event.rawMaterialId, event.id]),
    );

    for (const state of states) {
      const previouslyOutOfStock =
        state.isActive &&
        (state.previousUsableQuantity?.lessThanOrEqualTo(ZERO) ?? false);
      const nowOutOfStock =
        state.isActive && state.nextUsableQuantity.lessThanOrEqualTo(ZERO);
      const openEventId = openEventIdsByMaterialId.get(state.rawMaterialId);

      if (nowOutOfStock && !openEventId) {
        await tx.stockoutEvent.create({
          data: {
            entityType: StockoutEntityType.RAW_MATERIAL,
            entityId: state.rawMaterialId,
            rawMaterialId: state.rawMaterialId,
            startedAt: occurredAt,
            blockingContext: 'USABLE_QUANTITY_ZERO',
          },
        });
        continue;
      }

      if ((!nowOutOfStock || !state.isActive) && openEventId) {
        await tx.stockoutEvent.update({
          where: { id: openEventId },
          data: {
            endedAt: occurredAt,
          },
        });
        continue;
      }

      if (!previouslyOutOfStock && nowOutOfStock && openEventId) {
        await tx.stockoutEvent.update({
          where: { id: openEventId },
          data: {
            startedAt: occurredAt,
            endedAt: null,
            blockingContext: 'USABLE_QUANTITY_ZERO',
          },
        });
      }
    }
  }

  async recordVariantAvailabilityEvents(
    tx: TxClient,
    transitions: VariantAvailabilityTransition[],
    occurredAt: Date,
  ) {
    const eventRows = transitions
      .filter(
        (transition) =>
          transition.previousIsSellable === null ||
          transition.previousIsSellable !== transition.newIsSellable ||
          transition.previousBlockingReason !== transition.newBlockingReason,
      )
      .map((transition) => ({
        productVariantId: transition.productVariantId,
        previousIsSellable: transition.previousIsSellable,
        newIsSellable: transition.newIsSellable,
        previousBlockingReason: transition.previousBlockingReason,
        blockingReason: transition.newBlockingReason,
        availableBaseQty: transition.availableBaseQty,
        occurredAt,
      }));

    if (eventRows.length === 0) {
      return;
    }

    await tx.variantAvailabilityEvent.createMany({
      data: eventRows,
    });
  }
}
