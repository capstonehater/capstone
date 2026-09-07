DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'archived_at'
  ) THEN
    RAISE NOTICE 'Skipping forecasting foundation because the repaired archive schema is already present.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForecastRunType') THEN
    CREATE TYPE "ForecastRunType" AS ENUM ('MANUAL', 'SCHEDULED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ForecastRiskClassification') THEN
    CREATE TYPE "ForecastRiskClassification" AS ENUM ('HEALTHY', 'WATCH', 'RISK');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'raw_material_demand_observations'
  ) THEN
    CREATE TABLE "raw_material_demand_observations" (
      "id" TEXT NOT NULL,
      "business_date" DATE NOT NULL,
      "raw_material_id" TEXT NOT NULL,
      "total_consumed_quantity" DECIMAL(14,4) NOT NULL,
      "total_consumed_cost" DECIMAL(14,4) NOT NULL,
      "transaction_count" INTEGER NOT NULL DEFAULT 0,
      "distinct_order_count" INTEGER NOT NULL DEFAULT 0,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "raw_material_demand_observations_pkey" PRIMARY KEY ("id")
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'forecast_runs'
  ) THEN
    CREATE TABLE "forecast_runs" (
      "id" TEXT NOT NULL,
      "run_type" "ForecastRunType" NOT NULL,
      "business_date" DATE NOT NULL,
      "observation_window_start" DATE NOT NULL,
      "observation_window_end" DATE NOT NULL,
      "lookback_days" INTEGER NOT NULL,
      "forecast_horizons" INTEGER[] NOT NULL,
      "method_key" TEXT NOT NULL,
      "method_version" TEXT NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "forecast_runs_pkey" PRIMARY KEY ("id")
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'raw_material_forecast_outputs'
  ) THEN
    CREATE TABLE "raw_material_forecast_outputs" (
      "id" TEXT NOT NULL,
      "forecast_run_id" TEXT NOT NULL,
      "raw_material_id" TEXT NOT NULL,
      "business_date" DATE NOT NULL,
      "predicted_demand_7d" DECIMAL(14,4) NOT NULL,
      "predicted_demand_30d" DECIMAL(14,4) NOT NULL,
      "predicted_demand_90d" DECIMAL(14,4) NOT NULL,
      "burn_rate_used" DECIMAL(14,4) NOT NULL,
      "runway_at_run" DECIMAL(14,4),
      "risk_classification" "ForecastRiskClassification" NOT NULL,
      "suggested_restock_quantity" DECIMAL(14,4) NOT NULL,
      "confidence_score" DECIMAL(5,4) NOT NULL,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "raw_material_forecast_outputs_pkey" PRIMARY KEY ("id")
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'forecast_evaluations'
  ) THEN
    CREATE TABLE "forecast_evaluations" (
      "id" TEXT NOT NULL,
      "forecast_run_id" TEXT NOT NULL,
      "forecast_output_id" TEXT NOT NULL,
      "raw_material_id" TEXT NOT NULL,
      "business_date" DATE NOT NULL,
      "horizon_days" INTEGER NOT NULL,
      "predicted_quantity" DECIMAL(14,4) NOT NULL,
      "actual_quantity" DECIMAL(14,4) NOT NULL,
      "error_value" DECIMAL(14,4) NOT NULL,
      "error_percentage" DECIMAL(8,4),
      "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "forecast_evaluations_pkey" PRIMARY KEY ("id")
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'raw_material_forecast_policies'
  ) THEN
    CREATE TABLE "raw_material_forecast_policies" (
      "raw_material_id" TEXT NOT NULL,
      "lead_time_days" INTEGER NOT NULL,
      "minimum_reorder_quantity" DECIMAL(14,4),
      "preferred_supplier_id" TEXT,
      "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" TIMESTAMP(3) NOT NULL,

      CONSTRAINT "raw_material_forecast_policies_pkey" PRIMARY KEY ("raw_material_id")
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'raw_material_demand_observations_business_date_raw_material_id_key'
  ) THEN
    CREATE UNIQUE INDEX "raw_material_demand_observations_business_date_raw_material_id_key"
      ON "raw_material_demand_observations"("business_date", "raw_material_id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'raw_material_demand_observations_raw_material_id_business_date_idx'
  ) THEN
    CREATE INDEX "raw_material_demand_observations_raw_material_id_business_date_idx"
      ON "raw_material_demand_observations"("raw_material_id", "business_date");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'raw_material_demand_observations_business_date_idx'
  ) THEN
    CREATE INDEX "raw_material_demand_observations_business_date_idx"
      ON "raw_material_demand_observations"("business_date");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'forecast_runs_business_date_created_at_idx'
  ) THEN
    CREATE INDEX "forecast_runs_business_date_created_at_idx"
      ON "forecast_runs"("business_date", "created_at");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'raw_material_forecast_outputs_forecast_run_id_raw_material_id_key'
  ) THEN
    CREATE UNIQUE INDEX "raw_material_forecast_outputs_forecast_run_id_raw_material_id_key"
      ON "raw_material_forecast_outputs"("forecast_run_id", "raw_material_id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'raw_material_forecast_outputs_raw_material_id_business_date_idx'
  ) THEN
    CREATE INDEX "raw_material_forecast_outputs_raw_material_id_business_date_idx"
      ON "raw_material_forecast_outputs"("raw_material_id", "business_date");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'raw_material_forecast_outputs_business_date_idx'
  ) THEN
    CREATE INDEX "raw_material_forecast_outputs_business_date_idx"
      ON "raw_material_forecast_outputs"("business_date");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'forecast_evaluations_forecast_output_id_horizon_days_key'
  ) THEN
    CREATE UNIQUE INDEX "forecast_evaluations_forecast_output_id_horizon_days_key"
      ON "forecast_evaluations"("forecast_output_id", "horizon_days");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'forecast_evaluations_raw_material_id_business_date_idx'
  ) THEN
    CREATE INDEX "forecast_evaluations_raw_material_id_business_date_idx"
      ON "forecast_evaluations"("raw_material_id", "business_date");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'forecast_evaluations_forecast_run_id_idx'
  ) THEN
    CREATE INDEX "forecast_evaluations_forecast_run_id_idx"
      ON "forecast_evaluations"("forecast_run_id");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'raw_material_forecast_policies_preferred_supplier_id_idx'
  ) THEN
    CREATE INDEX "raw_material_forecast_policies_preferred_supplier_id_idx"
      ON "raw_material_forecast_policies"("preferred_supplier_id");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_demand_observations_raw_material_id_fkey') THEN
    ALTER TABLE "raw_material_demand_observations"
      ADD CONSTRAINT "raw_material_demand_observations_raw_material_id_fkey"
      FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_forecast_outputs_forecast_run_id_fkey') THEN
    ALTER TABLE "raw_material_forecast_outputs"
      ADD CONSTRAINT "raw_material_forecast_outputs_forecast_run_id_fkey"
      FOREIGN KEY ("forecast_run_id") REFERENCES "forecast_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_forecast_outputs_raw_material_id_fkey') THEN
    ALTER TABLE "raw_material_forecast_outputs"
      ADD CONSTRAINT "raw_material_forecast_outputs_raw_material_id_fkey"
      FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forecast_evaluations_forecast_run_id_fkey') THEN
    ALTER TABLE "forecast_evaluations"
      ADD CONSTRAINT "forecast_evaluations_forecast_run_id_fkey"
      FOREIGN KEY ("forecast_run_id") REFERENCES "forecast_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forecast_evaluations_forecast_output_id_fkey') THEN
    ALTER TABLE "forecast_evaluations"
      ADD CONSTRAINT "forecast_evaluations_forecast_output_id_fkey"
      FOREIGN KEY ("forecast_output_id") REFERENCES "raw_material_forecast_outputs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'forecast_evaluations_raw_material_id_fkey') THEN
    ALTER TABLE "forecast_evaluations"
      ADD CONSTRAINT "forecast_evaluations_raw_material_id_fkey"
      FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_forecast_policies_raw_material_id_fkey') THEN
    ALTER TABLE "raw_material_forecast_policies"
      ADD CONSTRAINT "raw_material_forecast_policies_raw_material_id_fkey"
      FOREIGN KEY ("raw_material_id") REFERENCES "raw_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'raw_material_forecast_policies_preferred_supplier_id_fkey') THEN
    ALTER TABLE "raw_material_forecast_policies"
      ADD CONSTRAINT "raw_material_forecast_policies_preferred_supplier_id_fkey"
      FOREIGN KEY ("preferred_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
