# Forecasting integration

The admin UI calls the Nest backend, which launches `forecast_bridge.py` as a hidden, non-interactive child process. The backend reads actual CHECKOUT ingredient quantities from completed POS orders, excluding refunded/voided orders, using Philippine calendar dates. POS replaces CSV quantities on transaction dates. The bridge calls `SARIMA.py` for demand and `InventoryRecommendation.py` for interpretation. PostgreSQL stores runs, material series, daily predictions and recommendations in four new tables.

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

Restart the backend after adding the module or generating Prisma. Open `/admin/forecasting` to view the latest saved seven-day forecast. The backend checks the weekly schedule automatically while it is running. Product selection filters the ingredients displayed, and the graph can show one saved week or compare two saved weeks.

## Endpoints (administrator session required)

- `GET /forecasting/products`: enabled, non-archived products.
- `GET /forecasting/runs/:id`: RUNNING, COMPLETED or FAILED status.
- `GET /forecasting/latest?productId=...&runId=...`: latest or selected completed results, saved periods and any active run.

Runs time out after 30 minutes. Interrupted runs are marked failed once their lease expires. Starting another run while one is active returns the existing run. Source CSVs are never overwritten by the web pipeline. Model assumptions, skipped materials and data sources appear in the page's model notes.

## Checks

```powershell
python -B -m unittest discover -s ../python -p test_forecast_bridge.py
npx.cmd jest forecasting.types.spec.ts --runInBand
npx.cmd tsc --noEmit -p tsconfig.build.json
```

See `CSV_ANALYSIS.md` for data issues, unit assumptions, and the distinction between product filtering and store-wide material demand.


## POS training updates

Each automatic weekly forecast reads a fresh database snapshot. Only completed sales before the forecast start date and at or before snapshot time are included. Ingredient quantities come from checkout ledger rows, including modifiers and split-batch consumption; current recipes are not used to reconstruct old sales. Voided/refunded orders contribute no demand, and their transaction dates remain covered so old CSV usage cannot reappear. Waste, stock deliveries and manual adjustments are excluded.

The next scheduled week includes completed sales recorded before its start. A future date never trains on sales from its own forecast period. POS and stock are read within one repeatable-read database transaction.

On dates with POS orders, actual POS totals replace the CSV for all materials. Other CSV dates remain historical backup. POS-only materials are supported once sufficient variable history exists. Weekend activity switches SARIMA to calendar-day observations and a seven-day seasonal cycle. Every forecast still contains exactly seven calendar dates. The model is not retrained on every checkout; newly saved sales enter the next automatic weekly forecast.

Run all Python tests with `python -B -m unittest discover -s ../python -p "test_*.py"`.

The web worker uses a log1p transformation (Box-Cox lambda 0) for SARIMA training and validation. This handles the real zero-demand days introduced by POS coverage and keeps inverse-transformed interval bounds defined. The original standalone CLI retains its automatic Box-Cox setting.
