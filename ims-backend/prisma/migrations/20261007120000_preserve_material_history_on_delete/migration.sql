BEGIN;
-- Detach historical records without deleting batches, ledger lines, or snapshots.
ALTER TABLE "stock_run_items" ADD COLUMN "raw_material_snapshot" JSONB;
ALTER TABLE "stock_batches" ADD COLUMN "raw_material_snapshot" JSONB;
ALTER TABLE "inventory_transaction_lines" ADD COLUMN "raw_material_snapshot" JSONB;
ALTER TABLE "inventory_daily_snapshots" ADD COLUMN "raw_material_snapshot" JSONB;
ALTER TABLE "store_availability_searches" ADD COLUMN "raw_material_snapshot" JSONB;

ALTER TABLE "stock_run_items" DROP CONSTRAINT "stock_run_items_raw_material_id_fkey";
ALTER TABLE "stock_run_items" ALTER COLUMN "raw_material_id" DROP NOT NULL;
ALTER TABLE "stock_run_items" ADD CONSTRAINT "stock_run_items_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_batches" DROP CONSTRAINT "stock_batches_raw_material_id_fkey";
ALTER TABLE "stock_batches" ALTER COLUMN "raw_material_id" DROP NOT NULL;
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_transaction_lines" DROP CONSTRAINT "inventory_transaction_lines_raw_material_id_fkey";
ALTER TABLE "inventory_transaction_lines" ALTER COLUMN "raw_material_id" DROP NOT NULL;
ALTER TABLE "inventory_transaction_lines" ADD CONSTRAINT "inventory_transaction_lines_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_daily_snapshots" DROP CONSTRAINT "inventory_daily_snapshots_raw_material_id_fkey";
ALTER TABLE "inventory_daily_snapshots" ALTER COLUMN "raw_material_id" DROP NOT NULL;
ALTER TABLE "inventory_daily_snapshots" ADD CONSTRAINT "inventory_daily_snapshots_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "store_availability_searches" DROP CONSTRAINT "store_availability_searches_raw_material_id_fkey";
ALTER TABLE "store_availability_searches" ALTER COLUMN "raw_material_id" DROP NOT NULL;
ALTER TABLE "store_availability_searches" ADD CONSTRAINT "store_availability_searches_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "alerts" ADD COLUMN "raw_material_snapshot" JSONB;
ALTER TABLE "stockout_events" ADD COLUMN "raw_material_snapshot" JSONB;
COMMIT;
