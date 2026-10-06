# Forecasting data audit â€” 10 September 2026

## Files and findings

| File | Records | Purpose | Finding |
| --- | ---: | --- | --- |
| `cafe_raw_material_daily_consumption.csv` | 258,021 | SARIMA training history | 38 product names, 55 raw materials, 438 dates from 2025-01-01 through 2026-09-04. All dates are weekdays. Units are kg, g, L, ml and pcs. No exact duplicate rows or negative quantities were found. |
| `current_inventory.csv` | 55 | Inventory and policy example | `Product` actually identifies a raw material. Contains CurrentStock, LeadTime and SafetyStock, but has no unit or snapshot date. Its stock quantities must not overwrite live inventory. |
| `forecast_database.csv` | 351 data rows | Previous SARIMA export | Missing its header; the first row begins `ex,Beef Tapa`. Only 51 materials remain. Beef Tapa has one forecast day, while 50 materials have seven business days. Dates span September 7â€“15, not seven calendar days. |
| `inventory_recommendation.csv` | 51 | Previous interpretation of the forecast export | 25 Critical, 1 High, 2 Medium, 6 Low and 17 Healthy records. These are historical output labels, not current stock alerts. |
| `raw_material_restocking.csv` | 51 | Ranked purchase list derived from recommendations | A downstream view of the same recommendations, not an independent source of demand or additional purchase quantities. |

There are 97,930 distinct transaction IDs in the consumption history. A transaction can contain multiple ingredient rows. Counting all rows as product sales would overstate demand; the integration forecasts ingredient quantities instead.

Baby Bangus, Bacon, Banana and Bechamel Sauce are entirely missing from the existing forecast export. Beef Tapa is incomplete. The export and its derived recommendation files are excluded from database ingestion. Original CSV files are retained unchanged for review. `InventoryRecommendation.load_inputs()` now rejects incomplete seven-date series.

## Database and catalog interpretation

The live database contained 71 enabled, non-archived products and 69 active raw materials during inspection. Product names differ from the historical CSV (for example, `Latte` versus `Cafe Latte`). No fuzzy product-name guesses or synthetic product sales are introduced.

The dropdown loads every enabled, non-archived database product. Its recipe and modifier ingredient IDs filter the saved store-wide material forecasts. Shared ingredients retain their store-wide demand and stock recommendations; filtering does not pretend that the entire stock belongs to one product. A product without matching forecast ingredients shows a no-data state.

Raw materials match by exact SKU first, then unique exact name, ignoring case. Ambiguous matches and incompatible units produce visible model notes. Mass and volume conversions are explicit (kg to g and L to ml). Counts cannot be converted to mass: for example, historical Banana usage in kg cannot be treated as the live Banana stock in pcs. The BOTTLE unit is treated as a count unit for bottled-water history in pcs.

## Forecast and recommendation rules

- Exactly seven consecutive calendar dates are saved. The historical business operates Mondayâ€“Friday, so weekend predictions are zero. The existing SARIMA model still learns the five-business-day seasonal cycle.
- The web worker uses four SARIMA candidates with three rolling validation folds and up to the most recent 260 business-day observations. The original CLI's wider search remains available. No moving-average substitute is silently used for failed fits.
- Box-Cox parameters for each validation fold are fitted to that fold's training data, avoiding validation-data leakage. Metrics, model orders, unit conversions, source hash and history end date are saved with results.
- Start dates must follow the latest historical date and stay within 60 days of it. Gaps are disclosed. POS ledger consumption is now merged into training at generation time; POS totals replace CSV quantities on covered transaction dates.
- `InventoryRecommendation.build_report()` owns the interpretation: seven-day usage, daily average, lead-time demand, reorder point, estimated coverage, stockout day, purchase quantity and priority.
- Current stock comes from the live usable-inventory summary at generation time. Missing summaries remain missing rather than being reported as healthy stock.
- LeadTime and SafetyStock come from the matching `current_inventory.csv` policy row. Because that file lacks units, safety-stock units are explicitly assumed to match that material's historical unit before conversion to the live unit. These policy assumptions are shown in the run's notes and should be reviewed by the inventory owner. The CSV CurrentStock field is ignored.
- Quantities are displayed in their saved inventory units, never labeled as pesos. Different units are not summed into a misleading total.

## Operational use

The admin page starts a background Python run, polls its database status, and reads persisted results. A unique active-run key prevents concurrent full retraining. Successful series and recommendations commit atomically; an empty or invalid result fails the run. Individual material failures remain visible in data notes. Previous completed forecasts remain available if a later run fails.

Forecasts and recommendations are snapshots. Generate again after changing training history, stock, or policies. No purchases, stock movements, or external messages are automatically issued.


## POS integration update

The CSV remains historical backup; it is no longer the sole source of demand. Checkout ledger quantities are grouped by stable material ID and Asia/Manila date. Only currently COMPLETED orders count. The set of covered transaction dates includes refunded/voided orders to avoid restoring CSV quantities after reversal. Actual quantities are already in live inventory units and are not converted a second time. The source hash includes POS totals and covered dates, and each series records its POS material/day count and snapshot timestamp.

Today's completed sales can be included by selecting tomorrow or a later start date. A partial-day warning is displayed when today's totals are present. Dates on or after the forecast start are excluded. POS-only ingredients with too little history remain unavailable rather than receiving invented predictions.

The web worker uses log1p (Box-Cox lambda 0) for SARIMA training and validation. This supports real zero-demand days and keeps inverse-transformed interval bounds defined. The standalone CLI retains automatic Box-Cox selection.
