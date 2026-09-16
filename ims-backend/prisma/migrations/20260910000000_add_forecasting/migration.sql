CREATE TABLE "forecast_runs" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "active_key" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "history_end" DATE,
  "source_hash" TEXT,
  "warnings" JSONB NOT NULL DEFAULT '[]',
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "forecast_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forecast_runs_seven_days" CHECK ("end_date" = "start_date" + 6)
);
CREATE UNIQUE INDEX "forecast_runs_active_key_key" ON "forecast_runs"("active_key");
CREATE INDEX "forecast_runs_status_created_at_idx" ON "forecast_runs"("status", "created_at");

CREATE TABLE "forecast_series" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "material_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "metadata" JSONB NOT NULL,
  CONSTRAINT "forecast_series_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forecast_series_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "forecast_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "forecast_series_run_id_material_id_key" ON "forecast_series"("run_id", "material_id");

CREATE TABLE "forecast_points" (
  "id" TEXT NOT NULL,
  "series_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "forecast" DECIMAL(18,4) NOT NULL,
  "lower_95" DECIMAL(18,4) NOT NULL,
  "upper_95" DECIMAL(18,4) NOT NULL,
  CONSTRAINT "forecast_points_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forecast_points_valid_bounds" CHECK ("lower_95" >= 0 AND "forecast" >= "lower_95" AND "upper_95" >= "forecast"),
  CONSTRAINT "forecast_points_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "forecast_series"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "forecast_points_series_id_date_key" ON "forecast_points"("series_id", "date");

CREATE TABLE "forecast_recommendations" (
  "id" TEXT NOT NULL,
  "series_id" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  CONSTRAINT "forecast_recommendations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forecast_recommendations_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "forecast_series"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "forecast_recommendations_series_id_key" ON "forecast_recommendations"("series_id");
