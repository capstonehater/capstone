# Forecasting integration

The admin UI calls the Nest backend, which launches `forecast_bridge.py` as a hidden, non-interactive child process. The backend reads actual CHECKOUT ingredient quantities from completed POS orders, excluding refunded/voided orders, using Philippine calendar dates. POS replaces CSV quantities on transaction dates. The bridge calls `SARIMA.py` for demand and `InventoryRecommendation.py` for interpretation. PostgreSQL stores runs, material series, daily predictions and recommendations along with a persistent forecast-duration setting.

## Setup

From `ims-backend`:

```powershell
npx.cmd prisma migrate deploy
npx.cmd prisma generate
```

Install Python dependencies with the Python interpreter the backend will use:

```powershell
python -m pip install -r ../python/requirements.txt
```

The backend defaults to `python` on PATH and the sibling `../python` folder when started from `ims-backend`. Optional backend environment variables:

```text
FORECAST_PYTHON_EXECUTABLE=C:\path\to\python.exe
FORECAST_PYTHON_DIR=C:\path\to\salvacion\python
```

Do not put shell arguments in the executable variable. Set an executable path only. The backend uses argument arrays and never invokes a shell for Python.

Restart the backend after adding the module or generating Prisma. Open `/admin/forecasting` to view the latest saved forecast. The backend checks the forecast schedule automatically while it is running. Product selection filters the ingredients displayed, and the graph can show one saved period or compare two saved periods.

## Endpoints (administrator session required)

- `PUT /forecasting/settings`: save `{ "forecastDays": 1 }` through `{ "forecastDays": 30 }`; returns the next period dates.
- `GET /forecasting/products`: enabled, non-archived products.
- `GET /forecasting/runs/:id`: RUNNING, COMPLETED or FAILED status.
- `GET /forecasting/latest?productId=...&runId=...`: latest or selected completed results, saved periods, any active run, and `nextForecastPeriod` (`days`, `startDate`, `endDate`).

Runs time out after 30 minutes. Interrupted runs are marked failed once their lease expires. Starting another run while one is active returns the existing run. Source CSVs are never overwritten by the web pipeline. Model assumptions, skipped materials and data sources appear in the page's model notes.

## Checks

```powershell
python -B -m unittest discover -s ../python -p test_forecast_bridge.py
npx.cmd jest forecasting.types.spec.ts --runInBand
npx.cmd tsc --noEmit -p tsconfig.build.json
```

See `CSV_ANALYSIS.md` for data issues, unit assumptions, and the distinction between product filtering and store-wide material demand.


## POS training updates

Each automatic forecast reads a fresh database snapshot. Only completed sales before the forecast start date and at or before snapshot time are included. Ingredient quantities come from checkout ledger rows, including modifiers and split-batch consumption; current recipes are not used to reconstruct old sales. Voided/refunded orders contribute no demand, and their transaction dates remain covered so old CSV usage cannot reappear. Waste, stock deliveries and manual adjustments are excluded.

The next scheduled period includes completed sales recorded before its start. A future date never trains on sales from its own forecast period. POS and stock are read within one repeatable-read database transaction.

On dates with POS orders, actual POS totals replace the CSV for all materials. Other CSV dates remain historical backup. POS-only materials are supported once sufficient variable history exists. The daily store schedule uses calendar-day observations and a seven-day seasonal cycle. Every forecast contains exactly the saved number of calendar dates (1–30). The model is not retrained on every checkout; newly saved sales enter the next automatic forecast.

Run all Python tests with `python -B -m unittest discover -s ../python -p "test_*.py"`.

The web worker and standalone CLI use a log1p transformation (Box-Cox lambda 0) for SARIMA training and validation. This handles zero-demand days and keeps inverse-transformed interval bounds defined.

## Saved forecast duration

Choose **Forecast days** between Product and Refresh records, then select **Save**.
The **Next forecast period** card shows the persisted duration and inclusive date range.
The default is 7 days; changes are shared across administrators and survive server restarts.
Saving changes the length of future runs, without recalculating completed or running forecasts.
The scheduler starts after the latest period ends in Philippine time; after downtime it starts
on the current date rather than backfilling past predictions. A running job snapshots its duration
when it is claimed, so a settings change cannot change its output length midway through training.

Recommendations use `ForecastTotal` and `ForecastDays`; `Forecast7Days` remains a legacy CSV
alias for the period total. Existing seven-day records remain readable. Percentage changes compare
against the same number of historical calendar days. The CLI also accepts
`python SARIMA.py --once --forecast-days 30` (CLI observations follow its business-day configuration).
The web bridge uses daily observations and seven-day seasonality for the store's daily
1 PM–10 PM Philippine schedule. Forecasts are daily totals, not hourly estimates.
Only complete Philippine calendar days enter POS training (today enters after midnight).

## Longer training histories

The bridge uses all available history by default, including the January 2023–July 2026 CSV.
Set `FORECAST_TRAINING_DAYS` on the backend to an integer of at least 60 to explicitly
limit the recent training window; `0` uses the full history. Model selection uses average
absolute validation error (MAE), which remains meaningful when validation days have zero usage.
MAPE is still reported when defined; it is not a future-accuracy guarantee.
The worker compares eight SARIMA choices with and without first differencing, enforces
stationary/invertible AR/MA components, and validates across the full prediction distance
(history gap plus requested forecast days). Actual validation windows appear in run notes.
Candidates are tried in validation-error order after fitting to the full history. Non-finite,
negative, or excessive outputs are rejected rather than clipped. The plausibility ceiling is
100 times the largest training-day amount (at least 1 unit), capped by the database limit.
If no candidate passes, that ingredient is excluded with a note. This guard is not an accuracy
guarantee; the chosen candidate and number of rejected choices are saved in the audit.

Forecast start must be after the latest history. The maximum start-date distance is now
365 days, configurable through `FORECAST_MAX_HISTORY_GAP_DAYS`. Gaps over 30 days produce
a stale-history note. Increasing this limit does not supply the missing observations.
Ingredient-specific gap lengths, actual training windows, and model checks are saved in notes.
The uploaded file is never rewritten, and incompatible units still require measured conversions.
