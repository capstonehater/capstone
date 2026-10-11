# Operational ingredient forecasting

The forecasting-page bridge defaults to `FORECAST_TRAINING_SOURCE=pos`.
Completed POS checkout ingredient consumption trains one model per ingredient.
Forecast dates and the current incomplete Philippine trading day are excluded.
The generated `historical-raw-material-data.csv` remains a development fixture
for standalone SARIMA experiments; it is never a substitute for missing POS.
`raw-materials-and-products.csv` supplies catalog identities and policy units;
current stock always comes from the live inventory snapshot.

The latest uninterrupted covered POS calendar segment is retained. An ingredient
with no checkout on a covered day has zero use. A date without store coverage is
unknown and is not silently imputed as zero. At least 60 covered days are required.
Recorded checkout unit snapshots are converted to the current inventory unit.
Incompatible dimensions are excluded with an explanation.

Models and interval calibration are saved under `python/trained_models`, or
`FORECAST_MODEL_CACHE_DIR`. Identical history reuses the fitted model. New days
refit the already selected configuration (preserving its training window), avoiding
the full grid search. A full search happens after 28 new calendar days, material
history revisions, changed forecast horizon, code/dependency changes, or a large
recent level/usage-frequency shift. Interval calibration is recalculated on refit.
Selection error metrics retain the date of the last full chronological search;
they are not represented as new validation scores after an update.

Cache writes are optional: a corrupt/unwritable cache triggers a fresh fit.
Historical requests cannot replace a newer artifact. Only trusted, internally
generated artifacts belong in the cache directory; pickle is not an interchange
format for downloaded models. Use `FORECAST_FORCE_FULL_RETRAIN=1` to force search,
or `FORECAST_DISABLE_MODEL_CACHE=1` to disable artifacts.

Constant POS usage uses a labelled seasonal-naive baseline. No positive usage
means percentage error and positive-demand coverage are undefined. A 95% interval
is a nominal target, with chronological measured coverage shown separately; no
accuracy or coverage guarantee is made. Sparse synthetic POS history may still
produce high errors. Daily intervals are not simultaneous seven-day bounds.

`FORECAST_TRAINING_SOURCE=mixed` is an explicit development comparison mode.
It preserves the previous CSV-plus-POS approach without model-cache reuse.
