# Forecast run diagnosis — October 2, 2026

## Confirmed cause

The saved forecast duration was **2 days**, but PostgreSQL still enforced the
original `forecast_runs_seven_days` constraint:

```sql
CHECK (end_date = start_date + 6)
```

Reproducing the scheduler produced PostgreSQL error **23514**:

```text
new row for relation "forecast_runs" violates check constraint "forecast_runs_seven_days"
```

The rejected period was October 2–3, 2026. The error occurred while creating the
run, before launching Python. The transaction rolled back, leaving no FAILED
run record. The latest saved period therefore remained September 25–October 1.
The forecast-duration settings migration created the setting but did not update
the original run constraint.

## Fix

- Added and applied `20261002000000_forecast_run_duration_range`, replacing the
  fixed seven-day constraint with an inclusive duration of 1–30 days.
- Recorded the migration as applied. An unrelated pending migration,
  `20260922000000_convert_voided_orders_to_refunds`, was not applied.
- Added scheduler-error reporting to the forecast response and page, and exposed
  the latest failed run's recorded error instead of only a generic retry message.
- Preserved the user's saved two-day duration and all existing forecasts.

## Verification

- 31 backend forecasting tests passed, including scheduler failure/recovery and
  failed-run error visibility.
- Backend and frontend TypeScript checks passed.
- All 17 Python tests passed.
- Transactional database probes accepted durations 1, 2, 7, and 30, and rejected
  0 and 31. Every probe was rolled back.
- The live scheduler automatically created run
  `ae3f61bf-5a0c-4a4c-8bdf-604e24fa823f` for October 2–3 at
  **9:20:44 PM Philippine time**, after the constraint was corrected.

## Earlier, separate failures

September 18 and 19 runs recorded PostgreSQL **22003: numeric field overflow**:
forecast values exceeded the `DECIMAL(18,4)` storage limit (absolute value below
10^14). Later runs completed successfully. Current worker validation already
checks this limit. Those historical errors were not the cause of the October 2
run-creation failure.
