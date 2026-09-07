-- CreateEnum
CREATE TYPE "ModifierSelectionMode" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "UnitDimension" AS ENUM ('MASS', 'VOLUME', 'COUNT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "StockRunStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('STOCK_RUN', 'CHECKOUT', 'ADJUSTMENT', 'WASTE', 'SYSTEM_IMPORT');

-- CreateEnum
CREATE TYPE "InventorySourceType" AS ENUM ('STOCK_RUN', 'ORDER', 'INVENTORY_ADJUSTMENT', 'SYSTEM_IMPORT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('COMPLETED', 'VOIDED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'GCASH', 'MAYA', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "AvailabilityBlockingReason" AS ENUM ('NONE', 'DISABLED_PRODUCT', 'DISABLED_VARIANT', 'NO_RECIPE', 'INSUFFICIENT_STOCK', 'NO_VALID_REQUIRED_MODIFIER');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "sku" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selection_mode" "ModifierSelectionMode" NOT NULL DEFAULT 'MULTIPLE',
    "default_min_select" INTEGER NOT NULL DEFAULT 0,
    "default_max_select" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifiers" (
    "id" TEXT NOT NULL,
    "modifier_group_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_adjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_modifier_groups" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "modifier_group_id" TEXT NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "allow_quantity" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_modifier_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dimension" "UnitDimension" NOT NULL,
    "conversion_factor" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_materials" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "reorder_point" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "address" TEXT,
    "contact_info" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_recipe_items" (
    "id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variant_recipe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modifier_recipe_adjustments" (
    "id" TEXT NOT NULL,
    "modifier_id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "quantity_delta" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modifier_recipe_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_runs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StockRunStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" TEXT NOT NULL,
    "total_cost" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_run_items" (
    "id" TEXT NOT NULL,
    "stock_run_id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "quantity" DECIMAL(14,4) NOT NULL,
    "cost_per_unit" DECIMAL(14,4) NOT NULL,
    "expiration_date" DATE,
    "received_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_batches" (
    "id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "stock_run_item_id" TEXT,
    "initial_quantity" DECIMAL(14,4) NOT NULL,
    "remaining_quantity" DECIMAL(14,4) NOT NULL,
    "cost_per_unit" DECIMAL(14,4) NOT NULL,
    "expiration_date" DATE,
    "received_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" TEXT NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "source_type" "InventorySourceType" NOT NULL,
    "source_id" TEXT,
    "actor_user_id" TEXT,
    "note" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transaction_lines" (
    "id" TEXT NOT NULL,
    "inventory_transaction_id" TEXT NOT NULL,
    "raw_material_id" TEXT NOT NULL,
    "stock_batch_id" TEXT NOT NULL,
    "product_variant_id" TEXT,
    "order_item_id" TEXT,
    "quantity_delta" DECIMAL(14,4) NOT NULL,
    "unit_cost_snapshot" DECIMAL(14,4) NOT NULL,
    "total_cost_delta" DECIMAL(14,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transaction_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "raw_material_inventory_summaries" (
    "raw_material_id" TEXT NOT NULL,
    "on_hand_quantity" DECIMAL(14,4) NOT NULL,
    "usable_quantity" DECIMAL(14,4) NOT NULL,
    "nearest_expiry_date" DATE,
    "active_batch_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "raw_material_inventory_summaries_pkey" PRIMARY KEY ("raw_material_id")
);

-- CreateTable
CREATE TABLE "variant_availability_summaries" (
    "product_variant_id" TEXT NOT NULL,
    "is_in_stock" BOOLEAN NOT NULL DEFAULT false,
    "is_sellable" BOOLEAN NOT NULL DEFAULT false,
    "available_base_qty" INTEGER NOT NULL DEFAULT 0,
    "blocking_reason" "AvailabilityBlockingReason" NOT NULL DEFAULT 'NONE',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variant_availability_summaries_pkey" PRIMARY KEY ("product_variant_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_by_user_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "subtotal_amount" DECIMAL(12,2) NOT NULL,
    "discount_code" TEXT,
    "discount_rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "total_cogs_amount" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_variant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_base_price" DECIMAL(12,2) NOT NULL,
    "unit_modifier_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit_final_price" DECIMAL(12,2) NOT NULL,
    "line_subtotal" DECIMAL(12,2) NOT NULL,
    "unit_cogs_amount" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "line_cogs_amount" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "note" TEXT,
    "product_name_snapshot" TEXT NOT NULL,
    "variant_name_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_modifiers" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "modifier_id" TEXT NOT NULL,
    "modifier_name_snapshot" TEXT NOT NULL,
    "unit_price_adjustment" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "line_total" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_item_modifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_sort_order_name_idx" ON "categories"("sort_order", "name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_parent_id_name_key" ON "categories"("parent_id", "name");

-- CreateIndex
CREATE INDEX "products_category_id_is_enabled_idx" ON "products"("category_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "products_category_id_name_key" ON "products"("category_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_is_enabled_idx" ON "product_variants"("product_id", "is_enabled");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_name_key" ON "product_variants"("product_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "modifier_groups_name_key" ON "modifier_groups"("name");

-- CreateIndex
CREATE INDEX "modifier_groups_sort_order_name_idx" ON "modifier_groups"("sort_order", "name");

-- CreateIndex
CREATE INDEX "modifiers_modifier_group_id_sort_order_idx" ON "modifiers"("modifier_group_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "modifiers_modifier_group_id_name_key" ON "modifiers"("modifier_group_id", "name");

-- CreateIndex
CREATE INDEX "product_modifier_groups_product_id_sort_order_idx" ON "product_modifier_groups"("product_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_modifier_groups_product_id_modifier_group_id_key" ON "product_modifier_groups"("product_id", "modifier_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_code_key" ON "units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "units_name_key" ON "units"("name");

-- CreateIndex
CREATE UNIQUE INDEX "raw_materials_sku_key" ON "raw_materials"("sku");

-- CreateIndex
CREATE INDEX "raw_materials_unit_id_idx" ON "raw_materials"("unit_id");

-- CreateIndex
CREATE INDEX "raw_materials_is_active_idx" ON "raw_materials"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");

-- CreateIndex
CREATE INDEX "variant_recipe_items_raw_material_id_idx" ON "variant_recipe_items"("raw_material_id");

-- CreateIndex
CREATE UNIQUE INDEX "variant_recipe_items_product_variant_id_raw_material_id_key" ON "variant_recipe_items"("product_variant_id", "raw_material_id");

-- CreateIndex
CREATE INDEX "modifier_recipe_adjustments_raw_material_id_idx" ON "modifier_recipe_adjustments"("raw_material_id");

-- CreateIndex
CREATE UNIQUE INDEX "modifier_recipe_adjustments_modifier_id_raw_material_id_key" ON "modifier_recipe_adjustments"("modifier_id", "raw_material_id");

-- CreateIndex
CREATE INDEX "stock_runs_status_created_at_idx" ON "stock_runs"("status", "created_at");

-- CreateIndex
CREATE INDEX "stock_runs_created_by_user_id_idx" ON "stock_runs"("created_by_user_id");

-- CreateIndex
CREATE INDEX "stock_run_items_stock_run_id_idx" ON "stock_run_items"("stock_run_id");

-- CreateIndex
CREATE INDEX "stock_run_items_raw_material_id_idx" ON "stock_run_items"("raw_material_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_batches_stock_run_item_id_key" ON "stock_batches"("stock_run_item_id");

-- CreateIndex
CREATE INDEX "stock_batches_raw_material_id_expiration_date_received_at_idx" ON "stock_batches"("raw_material_id", "expiration_date", "received_at");

-- CreateIndex
CREATE INDEX "stock_batches_remaining_quantity_idx" ON "stock_batches"("remaining_quantity");

-- CreateIndex
CREATE INDEX "inventory_transactions_type_occurred_at_idx" ON "inventory_transactions"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "inventory_transactions_source_type_source_id_idx" ON "inventory_transactions"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "inventory_transactions_actor_user_id_idx" ON "inventory_transactions"("actor_user_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_inventory_transaction_id_idx" ON "inventory_transaction_lines"("inventory_transaction_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_raw_material_id_created_at_idx" ON "inventory_transaction_lines"("raw_material_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_stock_batch_id_idx" ON "inventory_transaction_lines"("stock_batch_id");

-- CreateIndex
CREATE INDEX "inventory_transaction_lines_order_item_id_idx" ON "inventory_transaction_lines"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_created_by_user_id_created_at_idx" ON "orders"("created_by_user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_variant_id_idx" ON "order_items"("product_variant_id");

-- CreateIndex
CREATE INDEX "order_item_modifiers_order_item_id_idx" ON "order_item_modifiers"("order_item_id");

-- CreateIndex
CREATE INDEX "order_payments_order_id_idx" ON "order_payments"("order_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_idx" ON "outbox_events"("status", "available_at");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifiers" ADD CONSTRAINT "modifiers_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "modifier_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_modifier_group_id_fkey" FOREIGN KEY ("modifier_group_id") REFERENCES "modifier_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_materials" ADD CONSTRAINT "raw_materials_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_recipe_items" ADD CONSTRAINT "variant_recipe_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_recipe_items" ADD CONSTRAINT "variant_recipe_items_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_recipe_adjustments" ADD CONSTRAINT "modifier_recipe_adjustments_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "modifiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modifier_recipe_adjustments" ADD CONSTRAINT "modifier_recipe_adjustments_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_runs" ADD CONSTRAINT "stock_runs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_run_items" ADD CONSTRAINT "stock_run_items_stock_run_id_fkey" FOREIGN KEY ("stock_run_id") REFERENCES "stock_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_run_items" ADD CONSTRAINT "stock_run_items_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_run_items" ADD CONSTRAINT "stock_run_items_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_stock_run_item_id_fkey" FOREIGN KEY ("stock_run_item_id") REFERENCES "stock_run_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_inventory_transaction_id_fkey" FOREIGN KEY ("inventory_transaction_id") REFERENCES "inventory_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_stock_batch_id_fkey" FOREIGN KEY ("stock_batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_material_inventory_summaries" ADD CONSTRAINT "raw_material_inventory_summaries_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_availability_summaries" ADD CONSTRAINT "variant_availability_summaries_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_variant_id_fkey" FOREIGN KEY ("product_variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_modifier_id_fkey" FOREIGN KEY ("modifier_id") REFERENCES "modifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
