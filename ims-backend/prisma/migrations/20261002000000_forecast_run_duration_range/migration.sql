-- The duration setting supports 1–30 days; the original run constraint only
-- allowed seven days and rejected new jobs before a failure could be recorded.
BEGIN;
ALTER TABLE "forecast_runs"
  DROP CONSTRAINT "forecast_runs_seven_days",
  ADD CONSTRAINT "forecast_runs_duration_range"
    CHECK ("end_date" BETWEEN "start_date" AND "start_date" + 29);
COMMIT;
