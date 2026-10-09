import { PrismaClient } from '@prisma/client';

/**
 * Remove operational data only. Authentication, user profiles, RBAC assignments,
 * authorization audit records, and forecast settings are deliberately retained.
 */
export async function resetBusinessData(prisma: PrismaClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await prisma.$transaction(async (tx) => {
    const clear = async (table: string, operation: () => Promise<{ count: number }>) => {
      counts[table] = (await operation()).count;
    };

    await clear('outboxEvent', () => tx.outboxEvent.deleteMany());
    await clear('forecastPoint', () => tx.forecastPoint.deleteMany());
    await clear('forecastRecommendation', () => tx.forecastRecommendation.deleteMany());
    await clear('forecastSeries', () => tx.forecastSeries.deleteMany());
    await clear('forecastRun', () => tx.forecastRun.deleteMany());
    await clear('storeAvailabilityResult', () => tx.storeAvailabilityResult.deleteMany());
    await clear('storeAvailabilitySearch', () => tx.storeAvailabilitySearch.deleteMany());
    await clear('inventoryTransactionLine', () => tx.inventoryTransactionLine.deleteMany());
    await clear('orderItemModifier', () => tx.orderItemModifier.deleteMany());
    await clear('orderPayment', () => tx.orderPayment.deleteMany());
    await clear('orderReversal', () => tx.orderReversal.deleteMany());
    await clear('variantRecipeItem', () => tx.variantRecipeItem.deleteMany());
    await clear('modifierRecipeAdjustment', () => tx.modifierRecipeAdjustment.deleteMany());
    await clear('stockoutEvent', () => tx.stockoutEvent.deleteMany());
    await clear('variantAvailabilityEvent', () => tx.variantAvailabilityEvent.deleteMany());
    await clear('inventoryDailySnapshot', () => tx.inventoryDailySnapshot.deleteMany());
    await clear('rawMaterialInventorySummary', () => tx.rawMaterialInventorySummary.deleteMany());
    await clear('variantAvailabilitySummary', () => tx.variantAvailabilitySummary.deleteMany());
    await clear('alert', () => tx.alert.deleteMany());
    await clear('orderItem', () => tx.orderItem.deleteMany());
    await clear('order', () => tx.order.deleteMany());
    await clear('inventoryTransaction', () => tx.inventoryTransaction.deleteMany());
    await clear('stockBatch', () => tx.stockBatch.deleteMany());
    await clear('stockRunItem', () => tx.stockRunItem.deleteMany());
    await clear('stockRun', () => tx.stockRun.deleteMany());
    await clear('stockRunReferenceCounter', () => tx.stockRunReferenceCounter.deleteMany());
    await clear('productModifierGroup', () => tx.productModifierGroup.deleteMany());
    await clear('modifier', () => tx.modifier.deleteMany());
    await clear('modifierGroup', () => tx.modifierGroup.deleteMany());
    await clear('productVariant', () => tx.productVariant.deleteMany());
    await clear('product', () => tx.product.deleteMany());
    await clear('category', () => tx.category.deleteMany());
    await clear('rawMaterial', () => tx.rawMaterial.deleteMany());
    await clear('supplier', () => tx.supplier.deleteMany());
    await clear('unit', () => tx.unit.deleteMany());
  }, { maxWait: 10_000, timeout: 180_000 });
  return counts;
}
