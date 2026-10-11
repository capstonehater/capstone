# SARIMA data sources

Active CSV inputs:
- historical-raw-material-data.csv: synthetic ingredient-level usage history,
  2023-01-01 through 2026-08-31, covering 79 materials and 88 menu variants.
- raw-materials-and-products.csv: active material/product identities, SKU,
  units, and inventory reorder thresholds. This is the original catalog from
  ims-backend/prisma/exports; it matches the generator's catalog.

SARIMA.py and forecast_bridge.py both read the configured historical file.
Usage is summed by calendar date, material and unit before forecasting, with
seven-day seasonality and zero-filled missing calendar dates. Material and
product SKUs, names, variants and units are validated against the catalog.
SARIMA.py uses its own rolling validation; separate train/test CSVs are not
loaded by these runtime scripts.

Current stock comes from the system's live inventory snapshot, not the catalog.
The catalog has no current-stock quantities, supplier lead times or safety-stock
amounts. Missing stock remains unknown and produces No Data recommendations.
Lead time and safety stock default to zero because no supplied source defines
them. Catalog reorder points are converted into live material units. A purchase
covers forecast consumption plus an end-of-period stock target equal to the
larger of catalog reorder point and safety stock, minus measured current stock.
Catalog thresholds are used as provided and have not been optimized.

InventoryRecommendation.py uses the catalog reference for its standalone report.
Without a live stock snapshot this report marks stock and purchases as unknown;
use the forecast bridge for recommendations based on measured live stock.
forecast_database.csv, inventory_recommendation.csv and raw_material_restocking.csv
are generated outputs, not additional history. Old outputs and unused inputs
have been removed from the active folder into _archive for recovery.

Run `python SARIMA.py --once` to train all materials and regenerate forecasts.
The web worker trains on the same history and merges completed POS usage.
The catalog and history are included in the worker source hash.

This usage is synthetic and uses assumed recipes. Actual recent consumption is
needed to evaluate operational accuracy. History ends August 31, 2026; later
forecast periods require estimating the unobserved gap. No accuracy improvement
is claimed from renaming inputs or switching catalogs.
