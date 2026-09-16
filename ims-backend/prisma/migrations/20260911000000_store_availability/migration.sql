CREATE TABLE "store_availability_searches" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "raw_material_id" TEXT NOT NULL REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "product_name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3)
);
CREATE INDEX "store_availability_searches_raw_material_id_created_at_idx" ON "store_availability_searches"("raw_material_id", "created_at");
CREATE TABLE "store_availability_results" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "search_id" TEXT NOT NULL REFERENCES "store_availability_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "payload" JSONB NOT NULL
);
CREATE INDEX "store_availability_results_search_id_idx" ON "store_availability_results"("search_id");
