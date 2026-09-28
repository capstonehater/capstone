CREATE TABLE "forecast_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "forecast_days" INTEGER NOT NULL DEFAULT 7,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "forecast_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "forecast_settings_singleton" CHECK ("id" = 'default'),
  CONSTRAINT "forecast_settings_days_range" CHECK ("forecast_days" BETWEEN 1 AND 30)
);
INSERT INTO "forecast_settings" ("id", "forecast_days") VALUES ('default', 7);
