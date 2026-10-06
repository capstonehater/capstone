ALTER TABLE "stock_run_items"
  ADD COLUMN "purchase_cost" DECIMAL(18, 4),
  ADD COLUMN "price_quantity" DECIMAL(18, 4),
  ADD COLUMN "price_unit_code" TEXT;
