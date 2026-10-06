-- Retain fractional per-gram costs when normalizing KG and bulk prices.
ALTER TABLE "stock_run_items" ALTER COLUMN "cost_per_unit" TYPE DECIMAL(18, 8);
ALTER TABLE "stock_batches" ALTER COLUMN "cost_per_unit" TYPE DECIMAL(18, 8);
ALTER TABLE "inventory_transaction_lines" ALTER COLUMN "unit_cost_snapshot" TYPE DECIMAL(18, 8);
