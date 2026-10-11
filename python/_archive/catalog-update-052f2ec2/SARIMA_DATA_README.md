# Transferred SARIMA inputs

cafe_raw_material_daily_consumption.csv is the input already configured in
SARIMA.py and forecast_bridge.py. It contains daily totals for all 79 materials
from 2023-01-01 through 2026-08-31, including zero-usage days and CSV holiday
labels. The product column denotes aggregation across all products; it is not
product-level history. Material names, SKUs, and units match the supplied catalog.

sarima_train.csv and sarima_test.csv are optional chronological evaluation
inputs (the last 30 days are held out). The current SARIMA.py uses its own split
and cross-validation rather than reading these two files automatically.

sarima_ready_materials.csv and sarima_daily_material_usage.csv contain the
same complete daily totals in wide and long formats.
sarimax_calendar_features.csv contains known holiday/payday and annual features.
The current model uses holiday flags from its input; it does not automatically
load the extra calendar feature file. Additional regressors require matching
feature generation for historical AND future dates.

The usage is synthetic, based on assumed recipes, not measured cafe consumption.
Use real usage for operational prediction. No accuracy gain has been established.
Do not import both the daily file and transaction history as separate usage:
they represent the same consumption and summing both would double-count it.
History ends August 31, 2026; forecasting much later requires predicting across
that unobserved gap. Add actual recent usage to improve current forecasts.
