import { PrismaClient } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

/**
 * Remove operational data only. Authentication, user profiles, RBAC assignments,
 * authorization audit records, and forecast settings are deliberately retained.
 */
export async function resetBusinessData(prisma: PrismaClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const productImageUrls = await prisma.product.findMany({
    select: { imageUrl: true },
  });
  const profileImageUrls = await prisma.user.findMany({
    select: { profilePictureUrl: true },
  });
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
  const imageDirectory = resolve(process.cwd(), 'product-images');
  const localImagePath = (url: string | null) => {
    if (!url?.startsWith('/product-images/')) return null;
    const filename = basename(url);
    const filePath = resolve(imageDirectory, filename);
    return dirname(filePath) === imageDirectory ? filePath : null;
  };
  const profileImageFiles = new Set(
    profileImageUrls.flatMap(({ profilePictureUrl }) => {
      const filePath = localImagePath(profilePictureUrl);
      return filePath ? [filePath] : [];
    }),
  );
  const imageFiles = new Set(
    productImageUrls.flatMap(({ imageUrl }) => {
      const filePath = localImagePath(imageUrl);
      if (!filePath || profileImageFiles.has(filePath)) return [];
      return [filePath];
    }),
  );
  for (const filePath of imageFiles) {
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  counts.productImageFiles = imageFiles.size;
  return counts;
}
