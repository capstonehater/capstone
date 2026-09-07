BEGIN;

ALTER TABLE "products"
ADD COLUMN "archived_at" TIMESTAMP(3),
ADD COLUMN "archived_by_id" TEXT,
ADD COLUMN "archive_reason" TEXT;

CREATE INDEX "products_archived_at_idx" ON "products"("archived_at");

CREATE INDEX "products_category_id_archived_at_idx" ON "products"("category_id", "archived_at");

CREATE INDEX "inventory_transaction_lines_product_variant_id_idx" ON "inventory_transaction_lines"("product_variant_id");

ALTER TABLE "products"
ADD CONSTRAINT "products_archived_by_id_fkey"
FOREIGN KEY ("archived_by_id") REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

DROP TABLE "forecast_evaluations";

DROP TABLE "raw_material_forecast_outputs";

DROP TABLE "raw_material_forecast_policies";

DROP TABLE "forecast_runs";

DROP TABLE "raw_material_demand_observations";

DROP TYPE "ForecastRiskClassification";

DROP TYPE "ForecastRunType";

COMMIT;
