-- CreateEnum
CREATE TYPE "StockoutEntityType" AS ENUM ('RAW_MATERIAL', 'PRODUCT_VARIANT');

-- CreateTable
CREATE TABLE "stockout_events" (
    "id" TEXT NOT NULL,
    "entity_type" "StockoutEntityType" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "raw_material_id" TEXT,
    "product_variant_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "blocking_context" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stockout_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_availability_events" (
    "id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "previous_is_sellable" BOOLEAN,
    "new_is_sellable" BOOLEAN NOT NULL,
    "previous_blocking_reason" "AvailabilityBlockingReason",
    "blocking_reason" "AvailabilityBlockingReason" NOT NULL,
    "available_base_qty" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_availability_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_daily_snapshots" (
    "id" TEXT NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "on_hand_quantity" DECIMAL(14,4) NOT NULL,
    "usable_quantity" DECIMAL(14,4) NOT NULL,
    "inventory_value" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_daily_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stockout_events_entity_type_entity_id_started_at_idx" ON "stockout_events"("entity_type", "entity_id", "started_at");

-- CreateIndex
CREATE INDEX "stockout_events_raw_material_id_started_at_idx" ON "stockout_events"("raw_material_id", "started_at");

-- CreateIndex
CREATE INDEX "stockout_events_product_variant_id_started_at_idx" ON "stockout_events"("product_variant_id", "started_at");

-- CreateIndex
CREATE INDEX "stockout_events_ended_at_idx" ON "stockout_events"("ended_at");

-- CreateIndex
CREATE INDEX "variant_availability_events_product_variant_id_occurred_at_idx" ON "variant_availability_events"("product_variant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "variant_availability_events_occurred_at_idx" ON "variant_availability_events"("occurred_at");

-- CreateIndex
CREATE INDEX "inventory_daily_snapshots_snapshot_date_idx" ON "inventory_daily_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "inventory_daily_snapshots_raw_material_id_snapshot_date_idx" ON "inventory_daily_snapshots"("raw_material_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_daily_snapshots_snapshot_date_raw_material_id_key" ON "inventory_daily_snapshots"("snapshot_date", "raw_material_id");

-- AddForeignKey
ALTER TABLE "stockout_events" ADD CONSTRAINT "stockout_events_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stockout_events" ADD CONSTRAINT "stockout_events_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_availability_events" ADD CONSTRAINT "variant_availability_events_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_daily_snapshots" ADD CONSTRAINT "inventory_daily_snapshots_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
