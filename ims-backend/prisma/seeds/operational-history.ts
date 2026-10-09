import {
  AlertSeverity,
  AlertState,
  AlertType,
  AvailabilityBlockingReason,
  InventorySourceType,
  InventoryTransactionType,
  OrderReversalType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  StockoutEntityType,
} from '@prisma/client';
import { AvailabilityService } from '../../src/availability/availability.service';
import { InventoryStateHistoryService } from '../../src/availability/inventory-state-history.service';
import { OutboxService } from '../../src/events/outbox.service';
import { InventoryLedgerService } from '../../src/inventory/inventory-ledger.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { StockRunsService } from '../../src/stock-runs/stock-runs.service';
import { MATERIALS, MODIFIERS, SUPPLIERS, VARIANTS } from './catalog';
import type { CatalogIds } from './catalog-seed';
import {
  addDays,
  clamp,
  dateOnly,
  decimal,
  daysBetween,
  manilaDateTime,
  rngFor,
  stableId,
  weightedChoice,
} from './deterministic';

type BatchState = {
  id: string;
  reference: string;
  rawMaterialId: string;
  materialKey: string;
  supplierId: string;
  stockRunItemId: string;
  initialQuantity: number;
  remainingQuantity: number;
  costPerUnit: number;
  expirationDate: string | null;
  receivedAt: Date;
};

type Allocation = {
  batch: BatchState;
  quantity: number;
  cost: number;
};

type OperationalRows = {
  stockRuns: Prisma.StockRunCreateManyInput[];
  stockRunItems: Prisma.StockRunItemCreateManyInput[];
  stockBatches: Prisma.StockBatchCreateManyInput[];
  orders: Prisma.OrderCreateManyInput[];
  orderItems: Prisma.OrderItemCreateManyInput[];
  orderItemModifiers: Prisma.OrderItemModifierCreateManyInput[];
  payments: Prisma.OrderPaymentCreateManyInput[];
  reversals: Prisma.OrderReversalCreateManyInput[];
  transactions: Prisma.InventoryTransactionCreateManyInput[];
  transactionLines: Prisma.InventoryTransactionLineCreateManyInput[];
  inventorySnapshots: Prisma.InventoryDailySnapshotCreateManyInput[];
  alerts: Prisma.AlertCreateManyInput[];
  stockoutEvents: Prisma.StockoutEventCreateManyInput[];
  availabilityEvents: Prisma.VariantAvailabilityEventCreateManyInput[];
  storeSearches: Prisma.StoreAvailabilitySearchCreateManyInput[];
  storeResults: Prisma.StoreAvailabilityResultCreateManyInput[];
  forecastRuns: Prisma.ForecastRunCreateManyInput[];
  forecastSeries: Prisma.ForecastSeriesCreateManyInput[];
  forecastPoints: Prisma.ForecastPointCreateManyInput[];
  forecastRecommendations: Prisma.ForecastRecommendationCreateManyInput[];
  dailyConsumption: Map<string, number[]>;
  rawSummaries: Prisma.RawMaterialInventorySummaryCreateManyInput[];
  variantSummaries: Prisma.VariantAvailabilitySummaryCreateManyInput[];
};

const PH_HOLIDAYS = new Set([
  '01-01', '02-25', '04-09', '05-01', '06-12', '08-21', '11-01', '11-30',
  '12-24', '12-25', '12-30', '12-31',
]);

const INSERT_BATCH_SIZE = 500;
// These consumables are charged to inventory at the end of each insert window.
// They cannot be put back into saleable stock after an order refund.
const DAILY_POS_CONSUMABLES = new Set([
  'filtered_water', 'ice', 'cup_12', 'cup_22', 'lid_12', 'lid_22',
  'straw', 'napkin', 'food_box', 'sauce_bottle', 'oil', 'salt', 'pepper',
]);

function* operatingDays(dates: string[]): Generator<[number, string]> {
  for (let index = 0; index < dates.length; index += 1) yield [index, dates[index]];
}

export async function seedOperationalHistory(
  prisma: PrismaClient,
  ids: CatalogIds,
  startDate: string,
  endDateExclusive: string,
  stockRunsWorkflow?: Pick<
    StockRunsService,
    'createStockRun' | 'addStockRunItems' | 'postStockRun'
  >,
): Promise<Record<string, number>> {
  const dates = daysBetween(startDate, endDateExclusive);
  if (dates.length !== 365 || startDate !== '2025-10-07' || endDateExclusive !== '2026-10-07') {
    throw new Error('Synthetic history must cover October 7, 2025 through October 6, 2026.');
  }

  const rows: OperationalRows = {
    stockRuns: [], stockRunItems: [], stockBatches: [], orders: [], orderItems: [],
    orderItemModifiers: [], payments: [], reversals: [], transactions: [], transactionLines: [],
    inventorySnapshots: [], alerts: [], stockoutEvents: [], availabilityEvents: [],
    storeSearches: [], storeResults: [], forecastRuns: [], forecastSeries: [],
    forecastPoints: [], forecastRecommendations: [], dailyConsumption: new Map(),
    rawSummaries: [], variantSummaries: [],
  };
  const prismaService = prisma as unknown as PrismaService;
  const availability = stockRunsWorkflow
    ? undefined
    : new AvailabilityService(prismaService, new InventoryStateHistoryService());
  const stockRuns = stockRunsWorkflow ?? new StockRunsService(
    prismaService,
    new InventoryLedgerService(),
    availability!,
    new OutboxService(),
  );
  const counts: Record<string, number> = { days: dates.length };
  const lineIds = new Set<string>();
  const balanceByBatch = new Map<string, number>();
  const snapshotByKey = new Map<string, number>();
  const productsByMaterialDay = new Map<string, Set<string>>();

  for (const material of MATERIALS) rows.dailyConsumption.set(material.key, Array(dates.length).fill(0));

  const materials = new Map(MATERIALS.map((material) => [material.key, material]));
  const batchesByMaterial = new Map<string, BatchState[]>();
  for (const material of MATERIALS) batchesByMaterial.set(material.key, []);
  const availableQuantityByMaterial = new Map<string, number>();
  const expectedDailyUsage = estimateDailyUsage();
  const openLowAlerts = new Map<string, Prisma.AlertCreateManyInput>();
  const openMaterialStockouts = new Map<string, Prisma.StockoutEventCreateManyInput>();
  const openVariantStockouts = new Map<string, Prisma.StockoutEventCreateManyInput>();
  const availabilityState = new Map<string, boolean>();
  const pendingReversals = new Map<string, Array<{
    orderId: string;
    reversalId: string;
    type: OrderReversalType;
    actorUserId: string;
    occurredAt: Date;
    amount: number;
    paymentReference: string;
    checkoutLines: Prisma.InventoryTransactionLineCreateManyInput[];
    saleDayIndex: number;
  }>>();
  const materialKeyByMaterialId = new Map([...ids.materialIds.entries()].map(([key, id]) => [id, key]));
  const nearExpiryAlertByBatch = new Map<string, Prisma.AlertCreateManyInput>();
  const seenNearExpiryBatches = new Set<string>();
  const allBatches: BatchState[] = [];
  const batchById = new Map<string, BatchState>();
  const staffUserIds = ids.staffUserIds;
  const adminUserId = ids.administratorUserIds[0];

  let stockRunNumber = 0;
  const pooledConsumables = new Map<string, { batch: BatchState; quantity: number }>();
  for (const [dayIndex, date] of operatingDays(dates)) {
    const endOfInsertWindow = (dayIndex + 1) % 7 === 0 || dayIndex === dates.length - 1;
    const progress = dayIndex / Math.max(1, dates.length - 1);
    const dayRandom = rngFor(`operating-day:${date}`);

    // Fresh goods arrive every four days; durable ingredients arrive weekly.
    // A receipt always creates its batch and positive ledger line together.
    if (dayIndex % 7 === 0 || dayIndex % 4 === 0) {
      stockRunNumber += 1;
      await receiveWeeklyStock({
        date, dayIndex, progress, runNumber: stockRunNumber,
        ids, batchesByMaterial, allBatches, expectedDailyUsage,
        batchById, inventoryUsers: staffUserIds, stockRuns,
        balanceByBatch, counts,
        weekly: dayIndex % 7 === 0,
      });
    }

    // Reversals are scheduled days after checkout; replay them before that
    // day's sales so FEFO stock balances match the compensating ledger entries.
    for (const reversal of pendingReversals.get(date) ?? []) {
      let restoredLineCount = 0;
      for (const line of reversal.checkoutLines) {
        const batch = batchById.get(line.stockBatchId!);
        if (!batch) throw new Error(`Missing batch for reversal ${reversal.reversalId}`);
        // Expired source batches cannot return to usable stock. The reversal
        // still settles the order, but only eligible lines re-enter the ledger.
        if (batch.expirationDate && batch.expirationDate < date) continue;
        const quantity = Math.abs(Number(line.quantityDelta));
        const previousQuantity = batch.remainingQuantity;
        batch.remainingQuantity = roundQuantity(Math.min(batch.initialQuantity, previousQuantity + quantity));
        const restoredQuantity = roundQuantity(batch.remainingQuantity - previousQuantity);
        if (restoredQuantity === 0) continue;
        const materialKey = materialKeyByMaterialId.get(line.rawMaterialId!);
        if (materialKey) {
          const daily = rows.dailyConsumption.get(materialKey)!;
          daily[reversal.saleDayIndex] = Math.max(0, daily[reversal.saleDayIndex] - restoredQuantity);
        }
        rows.transactionLines.push({
          id: stableId('ledger-line-refund', `${reversal.reversalId}:${line.id}`),
          inventoryTransactionId: stableId('inventory-transaction-reversal', reversal.reversalId),
          rawMaterialId: line.rawMaterialId,
          stockBatchId: line.stockBatchId,
          productVariantId: line.productVariantId,
          orderItemId: line.orderItemId,
          quantityDelta: decimal(restoredQuantity),
          unitCostSnapshot: line.unitCostSnapshot,
          totalCostDelta: decimal(restoredQuantity * Number(line.unitCostSnapshot)),
          createdAt: reversal.occurredAt,
        });
        restoredLineCount += 1;
      }
      if (restoredLineCount > 0) rows.transactions.push({
        id: stableId('inventory-transaction-reversal', reversal.reversalId),
        type: reversal.type === OrderReversalType.VOID ? InventoryTransactionType.VOID : InventoryTransactionType.REFUND,
        sourceType: reversal.type === OrderReversalType.VOID ? InventorySourceType.ORDER_VOID : InventorySourceType.ORDER_REFUND,
        sourceId: reversal.reversalId,
        actorUserId: reversal.actorUserId,
        reasonCode: reversal.type === OrderReversalType.VOID ? 'INCORRECT_ORDER' : 'CUSTOMER_REFUND',
        metadata: { generator: 'synthetic-v1', orderId: reversal.orderId, reversalType: reversal.type, restoredLineCount } as Prisma.InputJsonObject,
        note: 'Eligible inventory returned to source batches.',
        occurredAt: reversal.occurredAt,
        createdAt: reversal.occurredAt,
        updatedAt: reversal.occurredAt,
      });
      rows.reversals.push({
        id: reversal.reversalId,
        orderId: reversal.orderId,
        actorUserId: reversal.actorUserId,
        type: reversal.type,
        reasonCode: reversal.type === OrderReversalType.VOID ? 'INCORRECT_ORDER' : 'CUSTOMER_REFUND',
        note: restoredLineCount > 0
          ? 'Synthetic order reversal with eligible inventory restored.'
          : 'Synthetic order reversal; source batches expired before inventory could be restored.',
        amount: decimal(reversal.amount, 2),
        paymentReference: reversal.paymentReference,
        metadata: { generator: 'synthetic-v1', approvedByUserId: adminUserId, restoredLineCount } as Prisma.InputJsonObject,
        occurredAt: reversal.occurredAt,
        createdAt: reversal.occurredAt,
        updatedAt: reversal.occurredAt,
      });
    }
    pendingReversals.delete(date);

    // Rebuild the material cache once per business day. FEFO updates
    // it incrementally, avoiding rescanning years of batch rows for each POS
    // item while keeping eligibility date-aware.
    for (const material of MATERIALS) {
      availableQuantityByMaterial.set(material.key, usableQuantity(material.key, date, batchesByMaterial));
    }

    // Expired stock is unusable by FEFO and is written off as a whole batch,
    // matching InventoryActionsService.logWaste's EXPIRED invariant.
    for (const batch of allBatches) {
      if (!batch.expirationDate || batch.expirationDate >= date || batch.remainingQuantity <= 0) continue;
      const occurredAt = manilaDateTime(date, 20, 5);
      const transactionId = stableId('inventory-transaction-expiry', batch.id);
      const lineId = stableId('ledger-line-expiry', batch.id);
      const quantity = batch.remainingQuantity;
      rows.transactions.push({
        id: transactionId,
        type: InventoryTransactionType.WASTE,
        sourceType: InventorySourceType.WASTE,
        sourceId: batch.id,
        actorUserId: pickUserForDay(staffUserIds, dayIndex, 'inventory'),
        reasonCode: 'EXPIRED',
        metadata: { generator: 'synthetic-v1', rawMaterialId: batch.rawMaterialId, batchId: batch.id } as Prisma.InputJsonObject,
        note: 'Expired stock written off from the full remaining batch quantity.',
        occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
      rows.transactionLines.push({
        id: lineId,
        inventoryTransactionId: transactionId,
        rawMaterialId: batch.rawMaterialId,
        stockBatchId: batch.id,
        quantityDelta: decimal(-quantity),
        unitCostSnapshot: decimal(batch.costPerUnit, 8),
        totalCostDelta: decimal(-quantity * batch.costPerUnit),
        createdAt: occurredAt,
      });
      batch.remainingQuantity = 0;
      rows.alerts.push(makeAlert({
        key: `expired:${batch.id}`, type: AlertType.EXPIRED,
        severity: AlertSeverity.CRITICAL, state: AlertState.RESOLVED,
        materialKey: batch.materialKey, batch, ids,
        firstTriggeredAt: manilaDateTime(date, 20, 0),
        resolvedAt: occurredAt,
        title: `${materials.get(batch.materialKey)!.name} batch expired`,
        message: `The synthetic batch ${batch.reference} passed its recorded expiry and was written off.`,
      }));
    }

    // A small rate of realistic damage/spoilage events complements full expiry
    // write-offs and always decrements the same batch that appears in the ledger.
    for (const material of MATERIALS) {
      const random = rngFor(`waste:${material.key}:${date}`);
      if (random() >= 0.0018) continue;
      const choices = (batchesByMaterial.get(material.key) ?? []).filter((batch) =>
        batch.remainingQuantity > 0 && (!batch.expirationDate || batch.expirationDate >= date),
      );
      if (choices.length === 0) continue;
      const batch = choices[Math.floor(random() * choices.length)];
      const quantity = Math.min(batch.remainingQuantity, Number(decimal(Math.max(0.01, batch.initialQuantity * (0.003 + random() * 0.012))).toFixed(4)));
      if (quantity <= 0) continue;
      batch.remainingQuantity = roundQuantity(batch.remainingQuantity - quantity);
      if (!batch.expirationDate || batch.expirationDate >= date) {
        availableQuantityByMaterial.set(material.key, Math.max(0, (availableQuantityByMaterial.get(material.key) ?? 0) - quantity));
      }
      const transactionId = stableId('inventory-transaction-waste', `${batch.id}:${date}`);
      const occurredAt = manilaDateTime(date, 5, 45);
      const reasonCode = random() < 0.55 ? 'SPOILAGE' : 'DAMAGED';
      rows.transactions.push({
        id: transactionId,
        type: InventoryTransactionType.WASTE,
        sourceType: InventorySourceType.WASTE,
        sourceId: batch.id,
        actorUserId: pickUserForDay(staffUserIds, dayIndex, 'inventory'),
        reasonCode,
        metadata: { generator: 'synthetic-v1', rawMaterialId: batch.rawMaterialId, batchId: batch.id } as Prisma.InputJsonObject,
        note: reasonCode === 'DAMAGED' ? 'Damaged goods found during receiving inspection.' : 'Spoilage removed during opening stock inspection.',
        occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
      rows.transactionLines.push({
        id: stableId('ledger-line-waste', `${batch.id}:${date}`),
        inventoryTransactionId: transactionId,
        rawMaterialId: batch.rawMaterialId,
        stockBatchId: batch.id,
        quantityDelta: decimal(-quantity),
        unitCostSnapshot: decimal(batch.costPerUnit, 8),
        totalCostDelta: decimal(-quantity * batch.costPerUnit),
        createdAt: occurredAt,
      });
    }

    const weekday = dateOnly(date).getUTCDay();
    const [, month, day] = date.split('-');
    const monthDay = `${month}-${day}`;
    const holidayBoost = PH_HOLIDAYS.has(monthDay) ? 1.45 : 1;
    const weekendBoost = weekday === 0 || weekday === 6 ? 1.32 : 0.92;
    const seasonalBoost = seasonalDemandFactor(Number(month), dayIndex);
    const paydayBoost = day === '01' || day === '15' ? 1.08 : 1;
    const growth = 1 + 0.06 * progress;
    const noise = 0.86 + dayRandom() * 0.28;
    const orderCount = Math.max(4, Math.round(8.2 * weekendBoost * holidayBoost * seasonalBoost * paydayBoost * growth * noise));
    for (let orderNumber = 0; orderNumber < orderCount; orderNumber += 1) {
      const cashierUserId = pickUserForDay(staffUserIds, dayIndex, 'cashier');
      const random = rngFor(`order:${date}:${orderNumber}`);
      const orderHour = weightedChoice([
        { value: 6, weight: 0.6 }, { value: 7, weight: 1.4 }, { value: 8, weight: 1.6 },
        { value: 9, weight: 1.35 }, { value: 10, weight: 1.15 }, { value: 11, weight: 1.1 },
        { value: 12, weight: 0.9 }, { value: 13, weight: 0.8 }, { value: 14, weight: 0.75 },
        { value: 15, weight: 0.8 }, { value: 16, weight: 0.9 }, { value: 17, weight: 1.05 },
        { value: 18, weight: 1.1 }, { value: 19, weight: 0.8 },
      ], random);
      const createdAt = manilaDateTime(date, orderHour, Math.floor(random() * 60), Math.floor(random() * 60));
      const orderId = stableId('order', `${date}:${orderNumber}`);
      const reversalRoll = dayIndex < dates.length - 21 ? random() : 1;
      const reversalType = reversalRoll < 0.008
        ? OrderReversalType.VOID
        : reversalRoll < 0.018 ? OrderReversalType.REFUND : null;
      const requestedLines = weightedChoice([
        { value: 1, weight: 0.58 }, { value: 2, weight: 0.35 }, { value: 3, weight: 0.07 },
      ], random);
      const selected = chooseAvailableVariants(requestedLines, Number(month), orderHour, random, availableQuantityByMaterial);
      if (selected.length === 0) continue;
      const orderItems: Array<{ row: Prisma.OrderItemCreateManyInput }> = [];
      const orderCheckoutLines: Prisma.InventoryTransactionLineCreateManyInput[] = [];
      let subtotal = 0;
      let totalCogs = 0;
      for (const variant of selected) {
        const selectedModifiers = chooseModifiers(variant, random);
        const recipe = recipeWithModifiers(variant.recipe, selectedModifiers);
        let itemQuantity = random() < 0.12 ? 2 : 1;
        if (!canFulfill(recipe, itemQuantity, availableQuantityByMaterial)) itemQuantity = 1;
        if (!canFulfill(recipe, itemQuantity, availableQuantityByMaterial)) continue;
        const priceMultiplier = priceMultiplierFor(dayIndex, dates.length);
        const unitPrice = roundToNearest(Math.max(1, variant.basePrice * priceMultiplier), 5);
        const modifierAmount = selectedModifiers.reduce((sum, modifier) => sum + modifier.priceAdjustment, 0);
        const finalUnitPrice = unitPrice + modifierAmount;
        const lineSubtotal = roundMoney(finalUnitPrice * itemQuantity);
        const itemId = stableId('order-item', `${orderId}:${variant.key}`);
        for (const modifier of selectedModifiers) {
          rows.orderItemModifiers.push({
            id: stableId('order-item-modifier', `${itemId}:${modifier.key}`),
            orderItemId: itemId,
            modifierId: ids.modifierIds.get(modifier.key)!,
            modifierNameSnapshot: modifier.name,
            unitPriceAdjustment: decimal(modifier.priceAdjustment, 2),
            quantity: 1,
            lineTotal: decimal(modifier.priceAdjustment, 2),
            createdAt,
            updatedAt: createdAt,
          });
        }
        let lineCogs = 0;
        for (const [materialKey, unitsPerProduct] of Object.entries(recipe)) {
          const needed = unitsPerProduct * itemQuantity;
          const allocations = allocateFefo(materialKey, needed, date, batchesByMaterial, availableQuantityByMaterial);
          if (allocations.length === 0 || allocations.some((allocation) => allocation.quantity <= 0)) {
            throw new Error(`FEFO allocation failed for ${variant.sku} on ${date}.`);
          }
          for (const [allocationNo, allocation] of allocations.entries()) {
            const lineId = stableId('ledger-line-sale', `${orderId}:${variant.key}:${materialKey}:${allocationNo}`);
            const lineCost = Number(decimal(allocation.quantity * allocation.batch.costPerUnit).toString());
            lineCogs += lineCost;
            const checkoutLine: Prisma.InventoryTransactionLineCreateManyInput = {
              id: lineId,
              inventoryTransactionId: stableId('inventory-transaction-checkout', orderId),
              rawMaterialId: allocation.batch.rawMaterialId,
              stockBatchId: allocation.batch.id,
              productVariantId: ids.variantIds.get(variant.key),
              orderItemId: itemId,
              quantityDelta: decimal(-allocation.quantity),
              unitCostSnapshot: decimal(allocation.batch.costPerUnit, 8),
              totalCostDelta: decimal(-lineCost),
              createdAt,
            };
            if (DAILY_POS_CONSUMABLES.has(materialKey)) {
              const pooled = pooledConsumables.get(allocation.batch.id) ?? { batch: allocation.batch, quantity: 0 };
              pooled.quantity = roundQuantity(pooled.quantity + allocation.quantity);
              pooledConsumables.set(allocation.batch.id, pooled);
            } else {
              orderCheckoutLines.push(checkoutLine);
            }
            const daily = rows.dailyConsumption.get(materialKey) ?? Array(dates.length).fill(0);
            daily[dayIndex] += allocation.quantity;
            rows.dailyConsumption.set(materialKey, daily);
          }
        }
        const roundedLineCogs = Number(decimal(lineCogs).toString());
        const unitCogs = roundedLineCogs / itemQuantity;
        subtotal += lineSubtotal;
        totalCogs += roundedLineCogs;
        orderItems.push({ row: {
            id: itemId,
            orderId,
            productVariantId: ids.variantIds.get(variant.key),
            quantity: itemQuantity,
            unitBasePrice: decimal(unitPrice, 2),
            unitModifierAmount: decimal(modifierAmount, 2),
            unitFinalPrice: decimal(finalUnitPrice, 2),
            lineSubtotal: decimal(lineSubtotal, 2),
            unitCogsAmount: decimal(unitCogs),
            lineCogsAmount: decimal(roundedLineCogs),
            note: null,
            productNameSnapshot: variant.productName,
            variantNameSnapshot: variant.variantName,
            skuSnapshot: variant.sku,
            createdAt,
            updatedAt: createdAt,
          },
        });
        for (const materialKey of Object.keys(recipe)) {
          const key = `${date}:${materialKey}`;
          const names = productsByMaterialDay.get(key) ?? new Set<string>();
          names.add(variant.productName);
          productsByMaterialDay.set(key, names);
        }
      }

      if (subtotal <= 0) continue;
      const isPromotion = random() < (monthDay === '12-25' ? 0.22 : 0.075);
      const discountRate = isPromotion ? (random() < 0.7 ? 0.05 : 0.1) : 0;
      const discountAmount = roundMoney(subtotal * discountRate);
      const totalAmount = roundMoney(Math.max(0, subtotal - discountAmount));
      const taxAmount = roundMoney(totalAmount - totalAmount / 1.12);
      if (![subtotal, discountAmount, taxAmount, totalAmount].every(Number.isInteger)) {
        throw new Error(`Order ${orderId} contains a non-whole-peso amount.`);
      }
      const completedAt = new Date(createdAt.getTime() + 2 * 60_000);
      rows.orders.push({
        id: orderId,
        status: reversalType === OrderReversalType.VOID ? OrderStatus.VOIDED
          : reversalType === OrderReversalType.REFUND ? OrderStatus.REFUNDED : OrderStatus.COMPLETED,
        createdByUserId: cashierUserId,
        idempotencyKey: `synthetic-v1-${date}-${String(orderNumber).padStart(3, '0')}`,
        subtotalAmount: decimal(subtotal, 2),
        discountCode: isPromotion ? (monthDay === '12-25' ? 'HOLIDAY_PROMO' : 'SEED_PROMO') : null,
        discountRate: decimal(discountRate, 4),
        discountAmount: decimal(discountAmount, 2),
        taxAmount: decimal(taxAmount, 2),
        totalAmount: decimal(totalAmount, 2),
        totalCogsAmount: decimal(totalCogs),
        notes: isPromotion ? 'Synthetic promotional sale.' : null,
        completedAt,
        createdAt,
        updatedAt: completedAt,
      });
      rows.orderItems.push(...orderItems.map((item) => item.row));
      rows.transactionLines.push(...orderCheckoutLines);
      // Modifier rows are inserted after their parent order items.
      rows.transactions.push({
        id: stableId('inventory-transaction-checkout', orderId),
        type: InventoryTransactionType.CHECKOUT,
        sourceType: InventorySourceType.ORDER,
        sourceId: orderId,
        actorUserId: cashierUserId,
        reasonCode: 'POS_CHECKOUT',
        metadata: { generator: 'synthetic-v1', itemCount: orderItems.length } as Prisma.InputJsonObject,
        note: null,
        occurredAt: completedAt,
        createdAt: completedAt,
        updatedAt: completedAt,
      });
      const methods = choosePayments(totalAmount, random);
      if (methods.some((payment) => !Number.isInteger(payment.amount))) {
        throw new Error(`Order ${orderId} contains a non-whole-peso payment.`);
      }
      for (const [paymentIndex, payment] of methods.entries()) {
        rows.payments.push({
          id: stableId('order-payment', `${orderId}:${paymentIndex}`),
          orderId,
          method: payment.method,
          amount: decimal(payment.amount, 2),
          reference: payment.method === PaymentMethod.CASH ? null : `SYN-PAY-${orderId.slice(0, 8)}-${paymentIndex + 1}`,
          receivedAt: completedAt,
          createdAt: completedAt,
          updatedAt: completedAt,
        });
      }
      if (reversalType) {
        const reversalId = stableId('order-reversal', orderId);
        const reversalDays = 1 + Math.floor(random() * 14);
        const reversalDate = dates[Math.min(dates.length - 1, dayIndex + reversalDays)];
        const occurredAt = manilaDateTime(reversalDate, 5, 15);
        const planned = pendingReversals.get(reversalDate) ?? [];
        planned.push({
          orderId,
          reversalId,
          type: reversalType,
          actorUserId: adminUserId,
          occurredAt,
          amount: totalAmount,
          paymentReference: `SYN-REV-${orderId.slice(0, 8)}`,
          checkoutLines: orderCheckoutLines,
          saleDayIndex: dayIndex,
        });
        pendingReversals.set(reversalDate, planned);
      }
    }

    if (endOfInsertWindow && pooledConsumables.size > 0) {
      const transactionId = stableId('pooled-pos-consumables', date);
      const occurredAt = manilaDateTime(date, 20, 30);
      rows.transactions.push({
        id: transactionId,
        type: InventoryTransactionType.CHECKOUT,
        sourceType: InventorySourceType.SYSTEM_IMPORT,
        sourceId: date,
        actorUserId: pickUserForDay(staffUserIds, dayIndex, 'cashier'),
        reasonCode: 'WEEKLY_POS_CONSUMABLES',
        metadata: { generator: 'synthetic-v1', pooled: true } as Prisma.InputJsonObject,
        note: 'Weekly non-restorable recipe and packaging consumption from synthetic POS sales.',
        occurredAt,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      });
      for (const { batch, quantity } of pooledConsumables.values()) {
        rows.transactionLines.push({
          id: stableId('pooled-pos-consumable-line', `${date}:${batch.id}`),
          inventoryTransactionId: transactionId,
          rawMaterialId: batch.rawMaterialId,
          stockBatchId: batch.id,
          quantityDelta: decimal(-quantity),
          unitCostSnapshot: decimal(batch.costPerUnit, 8),
          totalCostDelta: decimal(-quantity * batch.costPerUnit),
          createdAt: occurredAt,
        });
      }
      pooledConsumables.clear();
    }

    // Record daily state after receiving, sales, reversals, and waste so that
    // reports can query a contiguous Philippine-calendar inventory history.
    for (const material of MATERIALS) {
      const materialBatches = batchesByMaterial.get(material.key) ?? [];
      const onHand = materialBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
      const usableBatches = materialBatches.filter((batch) => !batch.expirationDate || batch.expirationDate >= date);
      const usable = usableBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
      const inventoryValue = materialBatches.reduce((sum, batch) => sum + batch.remainingQuantity * batch.costPerUnit, 0);
      rows.inventorySnapshots.push({
        id: stableId('inventory-daily-snapshot', `${date}:${ids.materialIds.get(material.key)}`),
        snapshotDate: dateOnly(date),
        rawMaterialId: ids.materialIds.get(material.key),
        rawMaterialSnapshot: materialSnapshot(material, ids),
        onHandQuantity: decimal(onHand),
        usableQuantity: decimal(usable),
        inventoryValue: decimal(inventoryValue),
        createdAt: manilaDateTime(date, 23, 50),
      });
      snapshotByKey.set(`${date}:${ids.materialIds.get(material.key)}`, usable);

      const previous = openLowAlerts.get(material.key);
      if (!previous && usable > 0 && usable <= material.reorderPoint) {
        const alert = makeAlert({
          key: `low-stock:${material.key}:${date}`, type: AlertType.LOW_STOCK,
          severity: AlertSeverity.WARNING, state: AlertState.ACTIVE,
          materialKey: material.key, ids,
          firstTriggeredAt: manilaDateTime(date, 20, 15),
          title: `${material.name} is below its reorder point`,
          message: `Available synthetic stock is ${usable.toFixed(2)} ${material.unitCode}; reorder point is ${material.reorderPoint} ${material.unitCode}.`,
          remainingQuantity: usable,
        });
        rows.alerts.push(alert);
        openLowAlerts.set(material.key, alert);
      } else if (previous && usable > material.reorderPoint) {
        previous.state = AlertState.RESOLVED;
        previous.resolvedAt = manilaDateTime(date, 7, 30);
        previous.lastTriggeredAt = manilaDateTime(date, 7, 30);
        openLowAlerts.delete(material.key);
      }

      const previousStockout = openMaterialStockouts.get(material.key);
      if (!previousStockout && usable <= 0) {
        const event: Prisma.StockoutEventCreateManyInput = {
          id: stableId('stockout-material', `${material.key}:${date}`),
          entityType: StockoutEntityType.RAW_MATERIAL,
          entityId: ids.materialIds.get(material.key)!,
          rawMaterialId: ids.materialIds.get(material.key),
          rawMaterialSnapshot: materialSnapshot(material, ids),
          startedAt: manilaDateTime(date, 12, 0),
          blockingContext: 'No non-expired batch quantity remained.',
          createdAt: manilaDateTime(date, 12, 0),
          updatedAt: manilaDateTime(date, 12, 0),
        };
        rows.stockoutEvents.push(event);
        openMaterialStockouts.set(material.key, event);
      } else if (previousStockout && usable > 0) {
        previousStockout.endedAt = manilaDateTime(date, 7, 0);
        previousStockout.updatedAt = manilaDateTime(date, 7, 0);
        openMaterialStockouts.delete(material.key);
      }
    }

    recordVariantAvailability(date, dayIndex, ids, rows, availableQuantityByMaterial, availabilityState, openVariantStockouts);
    createNearExpiryAlerts(date, dayIndex, ids, rows, allBatches, nearExpiryAlertByBatch, seenNearExpiryBatches, materials);
    resolveConsumedBatchAlerts(date, allBatches, nearExpiryAlertByBatch);
    if (endOfInsertWindow) {
      await persistWindowRows(prisma, rows, counts, lineIds, balanceByBatch);
    }
    if ((dayIndex + 1) % 90 === 0 || dayIndex === dates.length - 1) {
      console.log(`Seeded ${dayIndex + 1}/${dates.length} business days through ${date}.`);
    }
  }

  createSupplierSearchHistory(rows, ids, dates);
  await createForecastHistory(prisma, rows, ids, dates, snapshotByKey, productsByMaterialDay, counts);
  buildCurrentSummaries(rows, ids, MATERIALS, VARIANTS, batchesByMaterial, addDays(endDateExclusive, -1));

  const mismatchedBatch = allBatches.find((batch) =>
    Math.abs(batch.remainingQuantity - (balanceByBatch.get(batch.id) ?? 0)) > 0.0001);
  if (mismatchedBatch) {
    throw new Error(`Batch ${mismatchedBatch.reference} does not reconcile with the generated ledger.`);
  }
  await updateFinalBatchBalances(prisma, allBatches, manilaDateTime(addDays(endDateExclusive, -1), 23, 55));
  counts.alerts = (counts.alerts ?? 0) + rows.alerts.length;
  counts.stockoutEvents = (counts.stockoutEvents ?? 0) + rows.stockoutEvents.length;
  counts.storeAvailabilitySearches = rows.storeSearches.length;
  counts.storeAvailabilityResults = rows.storeResults.length;
  await persistOperationalRows(prisma, rows);
  return counts;
}

function estimateDailyUsage(): Map<string, number> {
  const popularityTotal = VARIANTS.reduce((total, variant) => total + variant.popularity, 0);
  const expectedItemsPerDay = 8.2 * 1.55 * 1.12;
  const usage = new Map(MATERIALS.map((material) => [material.key, 0]));
  for (const variant of VARIANTS) {
    const expectedLines = expectedItemsPerDay * (variant.popularity / popularityTotal);
    for (const [materialKey, quantity] of Object.entries(variant.recipe)) {
      usage.set(materialKey, (usage.get(materialKey) ?? 0) + expectedLines * quantity);
    }
  }
  for (const [key, value] of usage) usage.set(key, Math.max(value, 0.15));
  return usage;
}

async function receiveWeeklyStock(input: {
  date: string; dayIndex: number; progress: number; runNumber: number;
  ids: CatalogIds; batchesByMaterial: Map<string, BatchState[]>;
  allBatches: BatchState[]; expectedDailyUsage: Map<string, number>;
  batchById: Map<string, BatchState>; inventoryUsers: string[];
  weekly: boolean;
  stockRuns: Pick<
    StockRunsService,
    'createStockRun' | 'addStockRunItems' | 'postStockRun'
  >;
  balanceByBatch: Map<string, number>; counts: Record<string, number>;
}) {
  const { date, dayIndex, progress, runNumber, ids, batchesByMaterial, allBatches, expectedDailyUsage, batchById, inventoryUsers, stockRuns, balanceByBatch, counts } = input;
  const random = rngFor(`stock-run:${date}`);
  const receivedAt = manilaDateTime(date, 5, 30);
  const createdAt = new Date(receivedAt.getTime() - 30 * 60_000);
  const actorUserId = pickUserForDay(inventoryUsers, dayIndex, 'stock-run');
  const runReference = `ST-RUN-${date.replace(/-/g, '')}-001`;
  const receipts: Array<{
    batch: BatchState;
    item: {
      rawMaterialId: string;
      supplierId: string;
      quantity: number;
      costPerUnit: number;
      costQuantity: number;
      costUnitCode: string;
      expirationDate?: string;
      receivedAt: string;
      note: string;
    };
  }> = [];

  for (const material of MATERIALS) {
    if (!input.weekly && (material.expiryDays === 0 || material.expiryDays > 7)) continue;
    const supplier = supplierForMaterial(material.key, random);
    const supplierId = ids.supplierIds.get(supplier.key)!;
    const qtyBaseDays = material.expiryDays > 0 && material.expiryDays <= 7
      ? 4.6 + random() * 0.8 : 8.6 + random() * 2.1;
    const shortShipment = runNumber % 31 === 0 ? 0.62 : 1;
    const purchaseSeasonality = purchaseSeasonalFactor(Number(date.slice(5, 7)));
    const estimatedQuantity = (expectedDailyUsage.get(material.key) ?? 0.2)
      * (0.9 + 0.2 * progress) * qtyBaseDays * purchaseSeasonality * shortShipment;
    const quantity = material.unitCode === 'pcs'
      ? Math.max(1, Math.ceil(estimatedQuantity))
      : Math.max(0.0001, Number(decimal(estimatedQuantity).toFixed(4)));
    const costTrend = 0.78 + 0.22 * progress + 0.035 * Math.sin((progress * 5) * Math.PI * 2);
    const supplierPriceFactor = 0.94 + random() * 0.14;
    const costPerUnit = Math.max(0.0001, Number(decimal(material.baseCost * costTrend * supplierPriceFactor, 8).toString()));
    const priceBasis = priceBasisFor(material.unitCode);
    const purchaseCost = Number(decimal(costPerUnit * priceBasis.conversionFactor).toString());
    const expirationDate = material.expiryDays > 0 ? addDays(date, material.expiryDays) : null;
    const batch: BatchState = {
      id: '',
      reference: '',
      rawMaterialId: ids.materialIds.get(material.key)!,
      materialKey: material.key,
      supplierId,
      stockRunItemId: '',
      initialQuantity: quantity,
      remainingQuantity: quantity,
      costPerUnit,
      expirationDate,
      receivedAt,
    };
    receipts.push({
      batch,
      item: {
        rawMaterialId: batch.rawMaterialId,
        supplierId,
        quantity,
        costPerUnit: purchaseCost,
        costQuantity: 1,
        costUnitCode: priceBasis.unitCode,
        expirationDate: expirationDate ?? undefined,
        receivedAt: receivedAt.toISOString(),
        note: `Synthetic delivery from ${supplier.name}; supplier prices vary by period.`,
      },
    });
  }
  const createdRun = await stockRuns.createStockRun(
    {
      name: `Synthetic receiving ${date}`,
      notes: 'Synthetic supplier receipt generated through the stock-run workflow.',
    },
    actorUserId,
    { reference: runReference, createdAt },
  );
  await stockRuns.addStockRunItems(
    createdRun.id,
    receipts.map((receipt) => receipt.item),
    receivedAt,
  );
  const postedRun = await stockRuns.postStockRun(createdRun.id, actorUserId, receivedAt);
  if (!postedRun) throw new Error(`Stock run ${runReference} was not returned after posting.`);
  for (const receipt of receipts) {
    const item = postedRun.items.find(
      (candidate) => candidate.rawMaterialId === receipt.batch.rawMaterialId,
    );
    if (!item?.stockBatch) {
      throw new Error(`Stock run ${runReference} did not create a batch for ${receipt.batch.materialKey}.`);
    }
    receipt.batch.id = item.stockBatch.id;
    receipt.batch.reference = item.stockBatch.reference ?? `${runReference}-B01`;
    receipt.batch.stockRunItemId = item.id;
    batchesByMaterial.get(receipt.batch.materialKey)!.push(receipt.batch);
    allBatches.push(receipt.batch);
    batchById.set(receipt.batch.id, receipt.batch);
    balanceByBatch.set(receipt.batch.id, receipt.batch.initialQuantity);
  }
  counts.stockRuns = (counts.stockRuns ?? 0) + 1;
  counts.stockRunItems = (counts.stockRunItems ?? 0) + receipts.length;
  counts.stockBatches = (counts.stockBatches ?? 0) + receipts.length;
  counts.inventoryTransactions = (counts.inventoryTransactions ?? 0) + 1;
  counts.inventoryTransactionLines = (counts.inventoryTransactionLines ?? 0) + receipts.length;
  counts.outboxEvents = (counts.outboxEvents ?? 0) + 1;
}

function supplierForMaterial(materialKey: string, random: () => number) {
  const candidates = SUPPLIERS.filter((supplier) => supplier.materials.includes(materialKey));
  const supplier = weightedChoice(candidates.map((candidate, index) => ({
    value: candidate,
    weight: index === 0 ? 0.76 : 0.18,
  })), random);
  return supplier;
}

function pickUserForDay(userIds: string[], dayIndex: number, activity: string): string {
  return userIds[Math.floor(rngFor(`user:${activity}:${dayIndex}`)() * userIds.length)];
}

function chooseModifiers(variant: (typeof VARIANTS)[number], random: () => number) {
  const picked: typeof MODIFIERS = [];
  if (variant.recipe.whole_milk === 180 && random() < 0.13) {
    picked.push(MODIFIERS.find((modifier) => modifier.key === 'oat-milk-swap')!);
  }
  if (variant.recipe.coffee !== undefined && random() < 0.08) {
    picked.push(MODIFIERS.find((modifier) => modifier.key === 'extra-shot')!);
  }
  return picked;
}

function recipeWithModifiers(recipe: Record<string, number>, modifiers: typeof MODIFIERS): Record<string, number> {
  const adjusted = { ...recipe };
  for (const modifier of modifiers) {
    for (const [materialKey, quantity] of Object.entries(modifier.recipeAdjustments)) {
      adjusted[materialKey] = (adjusted[materialKey] ?? 0) + quantity;
      if (adjusted[materialKey] <= 0) delete adjusted[materialKey];
    }
  }
  return adjusted;
}

function chooseAvailableVariants(
  count: number,
  month: number,
  hour: number,
  random: () => number,
  availableQuantityByMaterial: Map<string, number>,
) {
  const selected: typeof VARIANTS = [];
  const available = [...VARIANTS];
  for (let index = 0; index < count && available.length > 0; index += 1) {
    const candidates = available.filter((variant) => canFulfill(variant.recipe, 1, availableQuantityByMaterial));
    if (candidates.length === 0) break;
    const variant = weightedChoice(candidates.map((entry) => ({
      value: entry,
      weight: entry.popularity * productSeasonality(entry, month) * timeOfDayFactor(entry, hour),
    })), random);
    selected.push(variant);
    available.splice(available.indexOf(variant), 1);
  }
  return selected;
}

function productSeasonality(variant: (typeof VARIANTS)[number], month: number): number {
  if ((variant.category === 'Lemonade' || variant.category === 'Ice-Blended') && [3, 4, 5].includes(month)) return 1.38;
  if (variant.variantName.startsWith('Hot') && [11, 12, 1, 2].includes(month)) return 1.28;
  if ((variant.category === 'Crepes' || variant.category === 'Waffles') && [11, 12].includes(month)) return 1.18;
  if (variant.productName.includes('Matcha') && [6, 7, 8].includes(month)) return 1.2;
  return 1;
}

function timeOfDayFactor(variant: (typeof VARIANTS)[number], hour: number): number {
  if (variant.category === 'All Day Breakfast') return hour < 11 ? 2.2 : hour < 15 ? 0.8 : 0.3;
  if (['Pasta', 'Pizza', 'Ala Carte'].includes(variant.category)) return hour >= 11 && hour <= 14 || hour >= 17 ? 1.75 : 0.45;
  if (variant.category === 'Coffee') return hour < 11 ? 1.65 : 0.9;
  if (['Crepes', 'Waffles', 'Ice-Blended'].includes(variant.category)) return hour >= 13 && hour <= 17 ? 1.5 : 0.75;
  return 1;
}

function seasonalDemandFactor(month: number, dayIndex: number): number {
  const yearEnd = month === 12 ? 1.1 : month === 11 ? 1.04 : 1;
  const drySeason = [3, 4, 5].includes(month) ? 1.04 : 1;
  const promotion = dayIndex % 90 < 5 ? 1.08 : 1;
  return yearEnd * drySeason * promotion;
}

function purchaseSeasonalFactor(month: number): number {
  if (month === 12) return 1.22;
  if (month === 11 || month === 1) return 1.08;
  if ([3, 4, 5].includes(month)) return 1.06;
  return 1;
}

function priceMultiplierFor(dayIndex: number, totalDays: number): number {
  const progress = dayIndex / Math.max(1, totalDays - 1);
  return 0.79 + 0.21 * progress;
}

function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function roundMoney(value: number): number {
  return Math.round(value + Number.EPSILON);
}

function roundQuantity(value: number): number {
  return Number(Math.max(0, value).toFixed(4));
}

function usableQuantity(materialKey: string, date: string, batches: Map<string, BatchState[]>): number {
  return (batches.get(materialKey) ?? []).reduce((total, batch) => {
    if (batch.remainingQuantity <= 0 || (batch.expirationDate && batch.expirationDate < date)) return total;
    return total + batch.remainingQuantity;
  }, 0);
}

function canFulfill(
  recipe: Record<string, number>,
  orderQuantity: number,
  availableQuantityByMaterial: Map<string, number>,
): boolean {
  return Object.entries(recipe).every(([materialKey, quantity]) =>
    (availableQuantityByMaterial.get(materialKey) ?? 0) + 0.00001 >= quantity * orderQuantity,
  );
}

function allocateFefo(
  materialKey: string,
  requestedQuantity: number,
  date: string,
  batchesByMaterial: Map<string, BatchState[]>,
  availableQuantityByMaterial: Map<string, number>,
): Allocation[] {
  let remaining = roundQuantity(requestedQuantity);
  const eligible = [...(batchesByMaterial.get(materialKey) ?? [])]
    .filter((batch) => batch.remainingQuantity > 0 && (!batch.expirationDate || batch.expirationDate >= date))
    .sort((left, right) => {
      if (left.expirationDate && right.expirationDate && left.expirationDate !== right.expirationDate) return left.expirationDate.localeCompare(right.expirationDate);
      if (left.expirationDate && !right.expirationDate) return -1;
      if (!left.expirationDate && right.expirationDate) return 1;
      const receivedDifference = left.receivedAt.getTime() - right.receivedAt.getTime();
      return receivedDifference || left.id.localeCompare(right.id);
    });
  const plan: Allocation[] = [];
  for (const batch of eligible) {
    if (remaining === 0) break;
    const quantity = roundQuantity(Math.min(remaining, batch.remainingQuantity));
    if (quantity <= 0) continue;
    plan.push({ batch, quantity, cost: quantity * batch.costPerUnit });
    remaining = roundQuantity(remaining - quantity);
  }
  if (remaining > 0) return [];
  for (const allocation of plan) allocation.batch.remainingQuantity = roundQuantity(allocation.batch.remainingQuantity - allocation.quantity);
  availableQuantityByMaterial.set(
    materialKey,
    roundQuantity((availableQuantityByMaterial.get(materialKey) ?? 0) - requestedQuantity),
  );
  return plan;
}

function choosePayments(total: number, random: () => number): Array<{ method: PaymentMethod; amount: number }> {
  const chooseMethod = () => weightedChoice([
    { value: PaymentMethod.CASH, weight: 0.43 },
    { value: PaymentMethod.GCASH, weight: 0.25 },
    { value: PaymentMethod.MAYA, weight: 0.13 },
    { value: PaymentMethod.CARD, weight: 0.14 },
    { value: PaymentMethod.OTHER, weight: 0.05 },
  ], random);
  if (random() >= 0.12) return [{ method: chooseMethod(), amount: roundMoney(total) }];
  const first = chooseMethod();
  let second = chooseMethod();
  while (second === first) second = chooseMethod();
  const firstAmount = roundMoney(total * (0.45 + random() * 0.2));
  return [
    { method: first, amount: firstAmount },
    { method: second, amount: roundMoney(total - firstAmount) },
  ];
}

function materialSnapshot(material: (typeof MATERIALS)[number], ids: CatalogIds): Prisma.InputJsonObject {
  return {
    id: ids.materialIds.get(material.key)!,
    name: material.name,
    sku: material.sku,
    unitCode: material.unitCode,
  };
}

function makeAlert(input: {
  key: string;
  type: AlertType;
  severity: AlertSeverity;
  state: AlertState;
  materialKey: string;
  ids: CatalogIds;
  batch?: BatchState;
  firstTriggeredAt: Date;
  resolvedAt?: Date;
  title: string;
  message: string;
  remainingQuantity?: number;
}): Prisma.AlertCreateManyInput {
  const approverId = input.ids.administratorUserIds[0];
  const material = MATERIALS.find((entry) => entry.key === input.materialKey)!;
  const acknowledged = input.state === AlertState.ACKNOWLEDGED || input.state === AlertState.DISMISSED;
  const acknowledgedAt = acknowledged ? new Date(input.firstTriggeredAt.getTime() + 10 * 60_000) : undefined;
  const dismissedAt = input.state === AlertState.DISMISSED ? new Date(input.firstTriggeredAt.getTime() + 20 * 60_000) : undefined;
  return {
    id: stableId('alert', input.key),
    dedupeKey: `synthetic-v1:${input.key}`,
    type: input.type,
    severity: input.severity,
    state: input.state,
    title: input.title,
    message: input.message,
    rawMaterialId: input.ids.materialIds.get(input.materialKey),
    rawMaterialSnapshot: materialSnapshot(material, input.ids),
    stockBatchId: input.batch?.id,
    supplierId: input.batch?.supplierId,
    expiryDate: input.batch?.expirationDate ? dateOnly(input.batch.expirationDate) : undefined,
    remainingQuantity: input.remainingQuantity !== undefined
      ? decimal(input.remainingQuantity)
      : input.batch ? decimal(input.batch.remainingQuantity) : undefined,
    metadata: {
      generator: 'synthetic-v1',
      materialSku: material.sku,
      ...(input.batch ? { batchReference: input.batch.reference } : {}),
    } as Prisma.InputJsonObject,
    firstTriggeredAt: input.firstTriggeredAt,
    lastTriggeredAt: input.firstTriggeredAt,
    acknowledgedAt,
    acknowledgedByUserId: acknowledged ? approverId : undefined,
    dismissedAt,
    dismissedByUserId: input.state === AlertState.DISMISSED ? approverId : undefined,
    resolvedAt: input.resolvedAt,
    createdAt: input.firstTriggeredAt,
    updatedAt: input.resolvedAt ?? dismissedAt ?? acknowledgedAt ?? input.firstTriggeredAt,
  };
}

function createNearExpiryAlerts(
  date: string,
  dayIndex: number,
  ids: CatalogIds,
  rows: OperationalRows,
  batches: BatchState[],
  alerted: Map<string, Prisma.AlertCreateManyInput>,
  seen: Set<string>,
  materials: Map<string, (typeof MATERIALS)[number]>,
) {
  for (const batch of batches) {
    if (!batch.expirationDate || seen.has(batch.id) || batch.remainingQuantity <= 0) continue;
    const daysToExpiry = Math.round((dateOnly(batch.expirationDate).getTime() - dateOnly(date).getTime()) / 86_400_000);
    if (daysToExpiry < 0 || daysToExpiry > 3) continue;
    const material = materials.get(batch.materialKey)!;
    const state = dayIndex % 3 === 0 ? AlertState.ACKNOWLEDGED : AlertState.ACTIVE;
    const alert = makeAlert({
      key: `near-expiry:${batch.id}`,
      type: AlertType.NEAR_EXPIRY,
      severity: daysToExpiry === 0 ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
      state,
      materialKey: batch.materialKey,
      ids,
      batch,
      firstTriggeredAt: manilaDateTime(date, 20, 0),
      title: `${material.name} batch is nearing expiry`,
      message: `Batch ${batch.reference} expires in ${daysToExpiry} day(s); apply FEFO and inspect the remaining stock.`,
      remainingQuantity: batch.remainingQuantity,
    });
    rows.alerts.push(alert);
    alerted.set(batch.id, alert);
    seen.add(batch.id);
  }
}

function resolveConsumedBatchAlerts(
  date: string,
  batches: BatchState[],
  alerts: Map<string, Prisma.AlertCreateManyInput>,
) {
  for (const batch of batches) {
    if (batch.remainingQuantity > 0) continue;
    const alert = alerts.get(batch.id);
    if (!alert || alert.state === AlertState.RESOLVED) continue;
    const resolvedAt = manilaDateTime(date, 20, 10);
    alert.state = AlertState.RESOLVED;
    alert.resolvedAt = resolvedAt;
    alert.updatedAt = resolvedAt;
    alerts.delete(batch.id);
  }
}

function recordVariantAvailability(
  date: string,
  _dayIndex: number,
  ids: CatalogIds,
  rows: OperationalRows,
  availableQuantityByMaterial: Map<string, number>,
  state: Map<string, boolean>,
  openStockouts: Map<string, Prisma.StockoutEventCreateManyInput>,
) {
  for (const variant of VARIANTS) {
    const quantities = Object.entries(variant.recipe).map(([materialKey, quantity]) =>
      Math.floor((availableQuantityByMaterial.get(materialKey) ?? 0) / quantity),
    );
    const availableBaseQty = quantities.length ? Math.max(0, Math.min(...quantities)) : 0;
    const isSellable = availableBaseQty > 0;
    const previous = state.get(variant.key);
    if (previous !== undefined && previous === isSellable) continue;
    rows.availabilityEvents.push({
      id: stableId('variant-availability-event', `${variant.key}:${date}:${isSellable}`),
      productVariantId: ids.variantIds.get(variant.key)!,
      previousIsSellable: previous,
      newIsSellable: isSellable,
      previousBlockingReason: previous === undefined ? null : previous ? AvailabilityBlockingReason.NONE : AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      blockingReason: isSellable ? AvailabilityBlockingReason.NONE : AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      availableBaseQty,
      occurredAt: manilaDateTime(date, 23, 45),
      createdAt: manilaDateTime(date, 23, 45),
    });
    state.set(variant.key, isSellable);
    const variantId = ids.variantIds.get(variant.key)!;
    if (!isSellable && previous !== false) {
      const occurredAt = manilaDateTime(date, 23, 45);
      const event: Prisma.StockoutEventCreateManyInput = {
        id: stableId('stockout-variant', `${variant.key}:${date}`),
        entityType: StockoutEntityType.PRODUCT_VARIANT,
        entityId: variantId,
        productVariantId: variantId,
        startedAt: occurredAt,
        blockingContext: 'Recipe components could not support one full serving.',
        createdAt: occurredAt,
        updatedAt: occurredAt,
      };
      rows.stockoutEvents.push(event);
      openStockouts.set(variant.key, event);
    } else if (isSellable && previous === false) {
      const event = openStockouts.get(variant.key);
      if (event) {
        event.endedAt = manilaDateTime(date, 23, 45);
        event.updatedAt = event.endedAt;
        openStockouts.delete(variant.key);
      }
    }
  }
}

function createSupplierSearchHistory(rows: OperationalRows, ids: CatalogIds, dates: string[]) {
  for (let dayIndex = 20, searchNumber = 0; dayIndex < dates.length; dayIndex += 28, searchNumber += 1) {
    const date = dates[dayIndex];
    const material = MATERIALS[(searchNumber * 7) % MATERIALS.length];
    const random = rngFor(`supplier-search:${date}:${material.key}`);
    const searchId = stableId('supplier-search', `${date}:${material.key}`);
    const createdAt = manilaDateTime(date, 10 + (searchNumber % 6), 20);
    const completedAt = new Date(createdAt.getTime() + 4 * 60_000);
    rows.storeSearches.push({
      id: searchId,
      rawMaterialId: ids.materialIds.get(material.key),
      rawMaterialSnapshot: materialSnapshot(material, ids),
      productName: material.name,
      status: 'COMPLETED',
      completedAt,
      createdAt,
    });
    const progress = dayIndex / Math.max(1, dates.length - 1);
    for (const supplier of SUPPLIERS) {
      const supplierId = ids.supplierIds.get(supplier.key)!;
      const hasOffer = supplier.materials.includes(material.key);
      const available = hasOffer && random() > 0.16;
      const priceFactor = 0.88 + random() * 0.27;
      const priceBasis = priceBasisFor(material.unitCode);
      const basePrice = material.baseCost * (0.78 + 0.22 * progress) * priceFactor * priceBasis.conversionFactor;
      const distanceKm = supplier.latitude !== null && supplier.longitude !== null
        ? haversineKm(14.31452, 120.941044, supplier.latitude, supplier.longitude)
        : null;
      const payload: Prisma.InputJsonObject = {
        supplier_id: supplierId,
        name: supplier.name,
        formatted_address: supplier.address,
        latitude: supplier.latitude,
        longitude: supplier.longitude,
        place_id: `synthetic-place-${supplier.key}`,
        status: !hasOffer ? 'NOT_LISTED' : available ? 'OK' : 'OUT_OF_STOCK',
        is_available: available,
        unit_price_php: available ? Number(basePrice.toFixed(2)) : null,
        price_quantity: 1,
        price_unit_code: priceBasis.unitCode,
        normalized_unit_cost_php: Number((basePrice / priceBasis.conversionFactor).toFixed(6)),
        unit_code: material.unitCode,
        estimated_delivery_days: distanceKm !== null && distanceKm < 5 ? 1 : 2 + Math.floor(random() * 3),
        distance_km: distanceKm === null ? null : Number(distanceKm.toFixed(2)),
        observed_at: createdAt.toISOString(),
        synthetic: true,
      };
      rows.storeResults.push({
        id: stableId('supplier-search-result', `${searchId}:${supplier.key}`),
        searchId,
        payload,
      });
    }
  }
}

async function createForecastHistory(
  prisma: PrismaClient,
  rows: OperationalRows,
  ids: CatalogIds,
  dates: string[],
  snapshotByKey: Map<string, number>,
  productsByMaterialDay: Map<string, Set<string>>,
  counts: Record<string, number>,
) {
  const seasonalFactor = (date: string) => {
    const month = Number(date.slice(5, 7));
    const weekend = [0, 6].includes(dateOnly(date).getUTCDay()) ? 1.05 : 0.98;
    return (1 + 0.08 * Math.sin(((month - 1) / 12) * 2 * Math.PI)) * weekend;
  };
  // Historical demand stops at the final seeded day. Forecast points must all
  // begin after that date, so only create the production forecast at the cutoff.
  const historyEnds = [dates.length - 1];
  for (const historyEndIndex of historyEnds) {
    const historyEnd = dates[historyEndIndex];
    const forecastStart = addDays(historyEnd, 1);
    const forecastEnd = addDays(forecastStart, 6);
    const runId = stableId('forecast-run', historyEnd);
    const createdAt = manilaDateTime(historyEnd, 23, 45);
    const completedAt = manilaDateTime(forecastStart, 0, 15);
    rows.forecastRuns.push({
      id: runId,
      status: 'COMPLETED',
      activeKey: null,
      startDate: dateOnly(forecastStart),
      endDate: dateOnly(forecastEnd),
      historyEnd: dateOnly(historyEnd),
      sourceHash: stableId('forecast-source', historyEnd),
      warnings: [
        'Synthetic seeded forecasts use a deterministic seasonal baseline; the Python SARIMA worker did not generate these rows.',
      ] as Prisma.InputJsonArray,
      error: null,
      createdAt,
      completedAt,
    });

    for (const material of MATERIALS) {
      const rawMaterialId = ids.materialIds.get(material.key)!;
      const seriesId = stableId('forecast-series', `${runId}:${rawMaterialId}`);
      const daily = rows.dailyConsumption.get(material.key)!;
      const window = daily.slice(0, historyEndIndex + 1);
      const trainingDays = window.length;
      const average = window.reduce((sum, value) => sum + value, 0) / window.length;
      const observedDays = window.filter((value) => value > 0).length;
      const recent = window.slice(-14).reduce((sum, value) => sum + value, 0) / 14;
      const trend = average > 0 ? clamp(recent / average, 0.8, 1.25) : 1;

      // Validate the same kind of simple seasonal/trend baseline on a held-out
      // week. These metrics describe this synthetic baseline, not SARIMA.
      const validationTraining = window.slice(0, -7);
      const validationAverage = validationTraining.reduce((sum, value) => sum + value, 0) / validationTraining.length;
      const earlierAverage = validationTraining.slice(0, -14).reduce((sum, value) => sum + value, 0)
        / Math.max(1, validationTraining.length - 14);
      const validationRecent = validationTraining.slice(-14).reduce((sum, value) => sum + value, 0) / 14;
      const validationTrend = earlierAverage > 0 ? clamp(validationRecent / earlierAverage, 0.8, 1.25) : 1;
      const validationActual = window.slice(-7);
      const validationDates = dates.slice(historyEndIndex - 6, historyEndIndex + 1);
      const validationPredicted = validationDates.map((date) => Math.max(0, validationAverage * validationTrend * seasonalFactor(date)));
      const absoluteErrors = validationActual.map((value, index) => Math.abs(value - validationPredicted[index]));
      const mae = absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length;
      const rmse = Math.sqrt(validationActual.reduce((sum, value, index) => sum + (value - validationPredicted[index]) ** 2, 0) / validationActual.length);
      const mapeValues = validationActual.flatMap((value, index) => value > 0 ? [absoluteErrors[index] / value * 100] : []);
      const smapeValues = validationActual.flatMap((value, index) => {
        const denominator = Math.abs(value) + Math.abs(validationPredicted[index]);
        return denominator > 0 ? [200 * absoluteErrors[index] / denominator] : [];
      });
      const mape = mapeValues.length ? mapeValues.reduce((sum, value) => sum + value, 0) / mapeValues.length : null;
      const smape = smapeValues.length ? smapeValues.reduce((sum, value) => sum + value, 0) / smapeValues.length : null;
      const previousUsage = window.slice(-7).reduce((sum, value) => sum + value, 0);
      const zeroDemandDays = window.filter((value) => value === 0).length;

      const trainingStart = dates[0];
      const trainingProducts = new Set<string>();
      for (let offset = 0; offset < trainingDays; offset += 1) {
        const productNames = productsByMaterialDay.get(`${dates[offset]}:${material.key}`);
        if (productNames) for (const productName of productNames) trainingProducts.add(productName);
      }
      const forecastValues = Array.from({ length: 7 }, (_, offset) => {
        const forecastDate = addDays(forecastStart, offset);
        return Math.max(0, average * trend * seasonalFactor(forecastDate));
      });
      const predictedForecastTotal = forecastValues.reduce((sum, value) => sum + value, 0);

      const metadata: Prisma.InputJsonObject = {
        model: 'Synthetic deterministic seasonal baseline',
        trainingDays,
        availableTrainingDays: trainingDays,
        order: [],
        seasonalOrder: [],
        transformation: 'none',
        candidateCount: 1,
        validationFolds: 1,
        metrics: {
          mae: Number(mae.toFixed(4)),
          rmse: Number(rmse.toFixed(4)),
          mape: mape === null ? null : Number(mape.toFixed(4)),
          smape: smape === null ? null : Number(smape.toFixed(4)),
        },
        historicalProducts: [...trainingProducts].sort(),
        sourceUnit: material.unitCode,
        conversionFactor: 1,
        trainingSource: 'Synthetic POS transaction history',
        posMaterialDays: observedDays,
        forecastDays: 7,
        previous7Days: Number(previousUsage.toFixed(4)),
        previousPeriodDays: 7,
        previousPeriodUsage: Number(previousUsage.toFixed(4)),
        changePercent: previousUsage > 0
          ? Number(((predictedForecastTotal - previousUsage) / previousUsage * 100).toFixed(2))
          : null,
        audit: {
          version: 1,
          trainingStart,
          trainingEnd: historyEnd,
          lastObservedWeekStart: dates[historyEndIndex - 6],
          lastObservedWeekEnd: historyEnd,
          csvDays: 0,
          posDays: observedDays,
          zeroFilledDays: trainingDays - observedDays,
          zeroDemandDays,
          bridgeCalendarDays: 0,
          weekdaysOnly: false,
          successfulCandidates: 1,
          selectionMetric: null,
          validationMethod: 'single holdout baseline check',
          rangeRejections: [],
          validationWindows: [{
            start: dates[historyEndIndex - 6],
            end: historyEnd,
            days: 7,
            mae: Number(mae.toFixed(4)),
            mape: mape === null ? null : Number(mape.toFixed(4)),
          }],
        },
        synthetic: true,
      };
      rows.forecastSeries.push({
        id: seriesId,
        runId,
        materialId: rawMaterialId,
        name: material.name,
        unit: material.unitCode,
        metadata,
      });

      for (let forecastOffset = 0; forecastOffset < 7; forecastOffset += 1) {
        const forecastDate = addDays(forecastStart, forecastOffset);
        const forecast = forecastValues[forecastOffset];
        rows.forecastPoints.push({
          id: stableId('forecast-point', `${seriesId}:${forecastDate}`),
          seriesId,
          date: dateOnly(forecastDate),
          forecast: decimal(forecast),
          lower95: decimal(forecast * 0.72),
          upper95: decimal(forecast * 1.34),
        });
      }

      const currentStockAtHistoryEnd = snapshotByKey.get(`${historyEnd}:${rawMaterialId}`) ?? 0;
      const forecastTotal = forecastValues.reduce((sum, value) => sum + value, 0);
      const dailyDemand = forecastTotal / forecastValues.length;
      const safetyStock = average * 3;
      const leadTime = 2;
      const leadTimeDemand = dailyDemand * leadTime;
      const reorderPoint = leadTimeDemand + safetyStock;
      const recommendedPurchase = Math.ceil(Math.max(0, forecastTotal + safetyStock - currentStockAtHistoryEnd));
      let projectedStock = currentStockAtHistoryEnd;
      let stockoutDay: number | null = null;
      forecastValues.forEach((forecast, index) => {
        projectedStock -= forecast;
        if (stockoutDay === null && projectedStock <= 0) stockoutDay = index + 1;
      });
      const priority = recommendedPurchase === 0
        ? 'Healthy'
        : stockoutDay === null ? 'Low'
          : stockoutDay <= 2 ? 'Critical'
            : stockoutDay <= 4 ? 'High' : 'Medium';
      const recommendationText = recommendedPurchase === 0
        ? 'Inventory is sufficient.'
        : stockoutDay === null
          ? `Restock ${recommendedPurchase} ${material.unitCode} on the next stock run to cover the forecast and safety stock.`
          : `Restock ${recommendedPurchase} ${material.unitCode} on the next stock run; current stock reaches zero by forecast day ${stockoutDay}.`;
      const supplierIds = SUPPLIERS
        .filter((supplier) => supplier.materials.includes(material.key))
        .map((supplier) => ids.supplierIds.get(supplier.key)!);
      rows.forecastRecommendations.push({
        id: stableId('forecast-recommendation', seriesId),
        seriesId,
        data: {
          CurrentStock: Number(currentStockAtHistoryEnd.toFixed(4)),
          SafetyStock: Number(safetyStock.toFixed(4)),
          DailyDemand: Number(dailyDemand.toFixed(4)),
          Forecast7Days: Number(forecastTotal.toFixed(4)),
          ForecastTotal: Number(forecastTotal.toFixed(4)),
          ForecastDays: 7,
          RecommendedPurchase: recommendedPurchase,
          DaysRemaining: dailyDemand > 0 ? Number((currentStockAtHistoryEnd / dailyDemand).toFixed(1)) : null,
          StockoutDay: stockoutDay,
          HasInventoryData: true,
          Priority: priority,
          Recommendation: recommendationText,
          ReorderPoint: Number(reorderPoint.toFixed(4)),
          LeadTime: leadTime,
          LeadTimeDemand: Number(leadTimeDemand.toFixed(4)),
          BuyOnNextRun: recommendedPurchase > 0 ? 'Yes' : 'No',
          ProjectedRemaining: Number((currentStockAtHistoryEnd + recommendedPurchase - forecastTotal).toFixed(4)),
          stockSource: 'synthetic daily inventory snapshot',
          policySource: 'synthetic 2-day lead time and 3-day average-demand safety stock',
          unit: material.unitCode,
          preferredSupplierIds: supplierIds,
          basis: '60-day synthetic POS consumption with weekday/weekend and monthly seasonality',
          synthetic: true,
        } as Prisma.InputJsonObject,
      });
    }
    await persistAndClear(rows.forecastRuns, 'forecastRuns', counts, (data) => prisma.forecastRun.createMany({ data }));
    await persistAndClear(rows.forecastSeries, 'forecastSeries', counts, (data) => prisma.forecastSeries.createMany({ data }));
    await persistAndClear(rows.forecastPoints, 'forecastPoints', counts, (data) => prisma.forecastPoint.createMany({ data }));
    await persistAndClear(rows.forecastRecommendations, 'forecastRecommendations', counts,
      (data) => prisma.forecastRecommendation.createMany({ data }));
  }
}

function buildCurrentSummaries(
  rows: OperationalRows,
  ids: CatalogIds,
  materials: typeof MATERIALS,
  variants: typeof VARIANTS,
  batchesByMaterial: Map<string, BatchState[]>,
  today: string,
) {
  const snapshotTime = manilaDateTime(today, 23, 55);
  for (const material of materials) {
    const batches = batchesByMaterial.get(material.key) ?? [];
    const onHand = batches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
    const usableBatches = batches.filter((batch) => !batch.expirationDate || batch.expirationDate >= today);
    const usable = usableBatches.reduce((sum, batch) => sum + batch.remainingQuantity, 0);
    const nearestExpiry = batches
      .filter((batch) => batch.remainingQuantity > 0 && batch.expirationDate && batch.expirationDate >= today)
      .sort((left, right) => left.expirationDate!.localeCompare(right.expirationDate!))[0]?.expirationDate;
    rows.rawSummaries.push({
      rawMaterialId: ids.materialIds.get(material.key)!,
      onHandQuantity: decimal(onHand),
      usableQuantity: decimal(usable),
      nearestExpiryDate: nearestExpiry ? dateOnly(nearestExpiry) : null,
      activeBatchCount: batches.filter((batch) => batch.remainingQuantity > 0).length,
      updatedAt: snapshotTime,
    });
  }
  for (const variant of variants) {
    const available = Object.entries(variant.recipe).map(([materialKey, quantity]) =>
      Math.floor(usableQuantity(materialKey, today, batchesByMaterial) / quantity),
    );
    const availableBaseQty = available.length ? Math.max(0, Math.min(...available)) : 0;
    const isInStock = availableBaseQty > 0;
    rows.variantSummaries.push({
      productVariantId: ids.variantIds.get(variant.key)!,
      isInStock,
      isSellable: isInStock,
      availableBaseQty,
      blockingReason: isInStock ? AvailabilityBlockingReason.NONE : AvailabilityBlockingReason.INSUFFICIENT_STOCK,
      updatedAt: snapshotTime,
    });
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degree: number) => degree * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function priceBasisFor(unitCode: string): { unitCode: string; conversionFactor: number } {
  if (unitCode === 'g') return { unitCode: 'KG', conversionFactor: 1000 };
  if (unitCode === 'ml') return { unitCode: 'L', conversionFactor: 1000 };
  return { unitCode: unitCode.toUpperCase(), conversionFactor: 1 };
}

async function persistAndClear<T>(
  records: T[], name: string, counts: Record<string, number>,
  insert: (data: T[]) => Promise<unknown>,
) {
  if (records.length === 0) return;
  await insertInChunks(records, insert);
  counts[name] = (counts[name] ?? 0) + records.length;
  records.length = 0;
}

async function persistWindowRows(
  prisma: PrismaClient,
  rows: OperationalRows,
  counts: Record<string, number>,
  lineIds: Set<string>,
  balanceByBatch: Map<string, number>,
) {
  for (const line of rows.transactionLines) {
    const id = line.id!;
    if (lineIds.has(id)) throw new Error(`Duplicate generated inventory ledger ID: ${id}`);
    lineIds.add(id);
    const batchId = line.stockBatchId!;
    balanceByBatch.set(batchId, roundQuantity((balanceByBatch.get(batchId) ?? 0) + Number(line.quantityDelta)));
  }

  await persistAndClear(rows.stockRuns, 'stockRuns', counts, (data) => prisma.stockRun.createMany({ data }));
  await persistAndClear(rows.stockRunItems, 'stockRunItems', counts, (data) => prisma.stockRunItem.createMany({ data }));
  await persistAndClear(rows.stockBatches, 'stockBatches', counts, (data) => prisma.stockBatch.createMany({ data }));
  await persistAndClear(rows.transactions, 'inventoryTransactions', counts, (data) => prisma.inventoryTransaction.createMany({ data }));
  await persistAndClear(rows.orders, 'orders', counts, (data) => prisma.order.createMany({ data }));
  await persistAndClear(rows.orderItems, 'orderItems', counts, (data) => prisma.orderItem.createMany({ data }));
  await persistAndClear(rows.orderItemModifiers, 'orderItemModifiers', counts, (data) => prisma.orderItemModifier.createMany({ data }));
  await persistAndClear(rows.payments, 'payments', counts, (data) => prisma.orderPayment.createMany({ data }));
  await persistAndClear(rows.reversals, 'reversals', counts, (data) => prisma.orderReversal.createMany({ data }));
  await persistAndClear(rows.transactionLines, 'inventoryTransactionLines', counts,
    (data) => prisma.inventoryTransactionLine.createMany({ data }));
  await persistAndClear(rows.inventorySnapshots, 'inventoryDailySnapshots', counts,
    (data) => prisma.inventoryDailySnapshot.createMany({ data }));
  await persistAndClear(rows.availabilityEvents, 'variantAvailabilityEvents', counts,
    (data) => prisma.variantAvailabilityEvent.createMany({ data }));
  const closedAlerts = rows.alerts.filter((alert) => alert.state === AlertState.RESOLVED || alert.state === AlertState.DISMISSED);
  await persistAndClear(closedAlerts, 'alerts', counts, (data) => prisma.alert.createMany({ data }));
  rows.alerts = rows.alerts.filter((alert) => alert.state !== AlertState.RESOLVED && alert.state !== AlertState.DISMISSED);
  const closedStockouts = rows.stockoutEvents.filter((event) => event.endedAt != null);
  await persistAndClear(closedStockouts, 'stockoutEvents', counts, (data) => prisma.stockoutEvent.createMany({ data }));
  rows.stockoutEvents = rows.stockoutEvents.filter((event) => event.endedAt == null);
}

async function updateFinalBatchBalances(prisma: PrismaClient, batches: BatchState[], updatedAt: Date) {
  for (let offset = 0; offset < batches.length; offset += INSERT_BATCH_SIZE) {
    const chunk = batches.slice(offset, offset + INSERT_BATCH_SIZE);
    const values = Prisma.join(chunk.map((batch) => Prisma.sql`(${batch.id}, ${decimal(batch.remainingQuantity)})`));
    await prisma.$executeRaw(Prisma.sql`
      UPDATE stock_batches AS b
      SET remaining_quantity = v.remaining_quantity::numeric, updated_at = ${updatedAt}
      FROM (VALUES ${values}) AS v(id, remaining_quantity)
      WHERE b.id = v.id
    `);
  }
}

async function persistOperationalRows(prisma: PrismaClient, rows: OperationalRows) {
  await insertInChunks(rows.stockRuns, (data) => prisma.stockRun.createMany({ data }));
  await insertInChunks(rows.stockRunItems, (data) => prisma.stockRunItem.createMany({ data }));
  await insertInChunks(rows.stockBatches, (data) => prisma.stockBatch.createMany({ data }));
  await insertInChunks(rows.transactions, (data) => prisma.inventoryTransaction.createMany({ data }));
  await insertInChunks(rows.orders, (data) => prisma.order.createMany({ data }));
  await insertInChunks(rows.orderItems, (data) => prisma.orderItem.createMany({ data }));
  await insertInChunks(rows.orderItemModifiers, (data) => prisma.orderItemModifier.createMany({ data }));
  await insertInChunks(rows.payments, (data) => prisma.orderPayment.createMany({ data }));
  await insertInChunks(rows.reversals, (data) => prisma.orderReversal.createMany({ data }));
  await insertInChunks(rows.transactionLines, (data) => prisma.inventoryTransactionLine.createMany({ data }));
  await insertInChunks(rows.inventorySnapshots, (data) => prisma.inventoryDailySnapshot.createMany({ data }));
  await insertInChunks(rows.alerts, (data) => prisma.alert.createMany({ data }));
  await insertInChunks(rows.stockoutEvents, (data) => prisma.stockoutEvent.createMany({ data }));
  await insertInChunks(rows.availabilityEvents, (data) => prisma.variantAvailabilityEvent.createMany({ data }));
  await insertInChunks(rows.storeSearches, (data) => prisma.storeAvailabilitySearch.createMany({ data }));
  await insertInChunks(rows.storeResults, (data) => prisma.storeAvailabilityResult.createMany({ data }));
  await insertInChunks(rows.forecastRuns, (data) => prisma.forecastRun.createMany({ data }));
  await insertInChunks(rows.forecastSeries, (data) => prisma.forecastSeries.createMany({ data }));
  await insertInChunks(rows.forecastPoints, (data) => prisma.forecastPoint.createMany({ data }));
  await insertInChunks(rows.forecastRecommendations, (data) => prisma.forecastRecommendation.createMany({ data }));

  for (const summary of rows.rawSummaries) {
    await prisma.rawMaterialInventorySummary.upsert({
      where: { rawMaterialId: summary.rawMaterialId! },
      update: {
        onHandQuantity: summary.onHandQuantity!,
        usableQuantity: summary.usableQuantity!,
        nearestExpiryDate: summary.nearestExpiryDate,
        activeBatchCount: summary.activeBatchCount!,
      },
      create: summary,
    });
  }
  for (const summary of rows.variantSummaries) {
    await prisma.variantAvailabilitySummary.upsert({
      where: { productVariantId: summary.productVariantId! },
      update: {
        isInStock: summary.isInStock!,
        isSellable: summary.isSellable!,
        availableBaseQty: summary.availableBaseQty!,
        blockingReason: summary.blockingReason!,
      },
      create: summary,
    });
  }
  await prisma.forecastSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: { id: 'default', forecastDays: 7 },
  });
}

async function insertInChunks<T>(rows: T[], insert: (data: T[]) => Promise<unknown>) {
  for (let offset = 0; offset < rows.length; offset += INSERT_BATCH_SIZE) {
    await insert(rows.slice(offset, offset + INSERT_BATCH_SIZE));
  }
}
