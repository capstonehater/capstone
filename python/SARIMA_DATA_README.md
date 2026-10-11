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
needed to evaluate operational accuracy. CSV history ends August 31, 2026; the
web worker extends it with completed POS dates. The default permitted distance
from latest history to forecast start is now 30 days (FORECAST_MAX_HISTORY_GAP_DAYS
can explicitly override it). No accuracy improvement
is claimed from renaming inputs or switching catalogs.

## Constrained model selection

CONSTRAINED_SELECTION enables a bounded 18-candidate SARIMA/SARIMAX search.
Each candidate uses three chronological validation windows, matching the
actual forecast distance (including the history gap). Models compare 182-day,
365-day and full-history training windows, log1p or scaled raw usage, an explicit
intercept for stationary models, and compact integrated alternatives. Six
alternatives model fixed weekday effects instead of weekly autoregression.
All historical data is retained; the selected fitting window is recorded per material.

The reference minimizes positive-day MAPE among candidates whose validation MAE
is within 10% of the best candidate's MAE (MAE_TOLERANCE=0.10). With
VOLUME_ESTIMATION=True, selection then minimizes the sum of absolute period-total
usage errors divided by actual usage. Candidates must also stay within 10% of
the reference MAPE and RMSE (OPERATIONAL_ERROR_TOLERANCE=0.10). This targets
inventory-period estimates while limiting additional daily error on validation.
VOLUME_ESTIMATION=False restores the MAPE objective on the configured candidate
grid. These validation constraints do not guarantee better held-out errors.
Every zero-demand day
remains in MAE/RMSE and the time series. MAPE is undefined for all-zero windows,
which are reported as null. The displayed fold average retains the prior
undefined-fold behavior for comparable reporting. Selection uses the finite
folds, disclosed separately as selectionMAPE; if none are defined, it uses MAE. This guard applies to
validation, not a guarantee of future error. Sparse daily demand may still have
high percentage error.

Only converged, finite fits are admitted. Stationarity/invertibility are enforced.
Both validation and inference prediction intervals must stay below 100 times
the training-window maximum and the database range limit. Negative predictions
have the same physical zero lower bound during validation and inference.
Implausible upper estimates are rejected, not capped to improve scores.
A failed refit tries the next eligible validated candidate; it never fabricates
predictions or bypasses the MAE guard. Optimizers are bounded to 100 iterations,
and fitting uses one BLAS thread to control CPU overhead.

The implementation of SARIMAX intercepts follows the official documentation:
https://www.statsmodels.org/stable/examples/notebooks/generated/statespace_sarimax_faq.html

The final 14-day comparison uses nested chronological model selection. Candidate
selection sees only dates before that test period. Baseline and revised models
are evaluated on the same dates, units and positive-day MAPE definition.
Absolute error is also reported so changes in zero-day demand cannot disappear
from the evaluation. Benchmark results remain in the generator workspace.

## Earlier point-selection evaluation

Backtest dates: 2026-09-23 through 2026-10-06. All 79 materials
were evaluated with nested chronological selection. 62 had positive demand
and defined MAPE in the final period; the other 17 remain in MAE evaluation.
Mean MAPE: 84.97% -> 77.42%.
Median MAPE: 96.43% -> 92.04%.
MAPE improved for 41 materials, worsened for 10, and was equal for 11.
MAE improved or stayed equal for 48 of 79 materials; median per-material
relative MAE change was approximately zero. The MAE guard had no CV violations,
but it does not guarantee unchanged held-out MAE for every material.
36 materials selected a recent window. Sparse daily usage remains difficult.
These backtest figures differ from the earlier rolling-validation summary;
they are a matched baseline-versus-revised comparison, not a claim that the
earlier 88.2% metric uses the same evaluation period.

Detailed results: generator/sarima_tuning/verified_holdout_benchmark.csv.
The constraints and optimizer settings are fixed, not material-specific choices
based on the final period. Held-out observations are never used by model fitting.


## Prediction intervals and measured coverage

Confidence is no longer calculated as 100 minus MAPE. Daily ranges target 95%
coverage; reported coverage is the fraction of actual usage amounts contained
in earlier test intervals, with sample counts and positive-demand coverage.
These are different measurements from point-forecast MAPE.

Production still selects from the latest three validation folds and refits on
all available completed history (or the selected 182/365-day window). An earlier
selection is evaluated on five later forecast periods that were excluded from its
selection and parameter fitting. Overlapping candidate forecasts are cached.
If the production configuration changes after observing those periods, the earlier
configuration is recorded in predictionInterval.validationConfiguration.
Coverage describes the forecasting procedure's earlier test, not a guarantee
for the latest fitted parameters.

Intervals use a rolling buffer of twelve completed forecast periods. Errors are
scaled by the original model's horizon-specific interval width, with a floor
learned from earlier history. A finite-sample order statistic, ceil((n+1)*0.95),
sets the radius separately for seven-day horizon buckets. Short final buckets
pool residuals when fewer than 19 observations exist. A 1e-8 radius floor avoids
numerical intervals incorrectly excluding exact zero usage. Bounds remain
nonnegative and subject to the existing range checks; point estimates are
unchanged by calibration. Old historical errors leave the rolling buffer as
completed new periods enter it.

INTERVAL_POSITIVE_DEMAND_GUARD additionally widens the upper bound using scaled
underprediction errors on earlier positive-usage days. Weekly buckets with fewer
than 19 positive samples pool positive samples across horizons. If that pool
also has fewer than 19 samples, the observed maximum is used and explicitly
labeled observed_positive_maximum; it is not a validated positive-demand 95%
quantile. Materials with at least 5% zero days in calibration retain a zero lower
bound. Both protections can widen ranges without changing point forecasts.

Calibration backcasts use a selected configuration and can overlap its selection
folds. Time-series errors are dependent and demand can change, so this is empirical
calibration, not a distribution-free conformal coverage guarantee. Later interval
testing is separate from the earlier selection. Interval score (width plus a
penalty for misses), mean width and positive-demand coverage are recorded to avoid
calling extremely wide ranges or zero-heavy coverage alone a success.

The worker matches coverage to the requested seven forecast dates, including any
unobserved history gap. Five successful test periods supply 35 requested-day
observations (70 total observations when the forecast distance is 14 days).
The UI shows counts, positive-day coverage, weakest-period coverage and limits.
Short/failed calibration falls back
to model-based ranges with empirical coverage unavailable. Existing saved seed
runs have no new calibration metadata and are displayed as unverified ranges.
Daily bounds are pointwise: adding their bounds is not a simultaneous 95% interval
for total weekly stock consumption.

INTERVAL_CALIBRATION_FOLDS defaults to 12 and INTERVAL_VALIDATION_FOLDS to 5.
The backend batch timeout is 120 minutes because longer validation adds rolling refits.
No new datasets, package dependencies or database writes are required. Inputs
remain historical-raw-material-data.csv plus raw-materials-and-products.csv and
the system's completed POS snapshot. Weekly seasonality and Philippine holidays
remain enabled. Extra annual/pay-period calendar candidates were tested and not
retained after worsening a pilot forecast.

forecast_insights.py reports held-out volume-weighted daily error (WAPE), signed
total-usage bias and daily absolute-error skill against repeating the last observed
week. These use the requested horizon, including its gap, and quantities are
never added across materials with different units. Estimated shortage and the
sum-of-daily-upper-bounds stock stress scenario use the live stock snapshot;
the latter is explicitly not a 95% period-total interval and does not automatically
increase the purchase recommendation.

Evidence status is a configurable planning check, not an accuracy probability.
The defaults require at least 30 held-out days, 20 positive-usage test days, WAPE
at most 30%, overall and positive-day coverage at the 95% target, improvement
over the repeating-week baseline, and no test period below 80% coverage. Missing
history beyond seven gap days, recent all-zero demand and intermittent usage
also trigger caution. Inadequate samples are limited evidence. Thresholds live
in SARIMA.CONFIG as INSIGHT_MIN_TEST_DAYS, INSIGHT_MIN_POSITIVE_DAYS,
INSIGHT_MAX_WAPE, INSIGHT_MIN_PERIOD_COVERAGE and INSIGHT_MAX_HISTORY_GAP_DAYS.

The grid fits only the earlier/current selection folds; intermediate outer tests
refit just the selected configuration. Point selection still uses the latest
three folds, so longer interval testing does not discard recent history.

Real daily POS sales, verified recipe quantities, waste, stockout/closure flags,
and known future promotions would support further operational forecasting work.
Generated usage and seeded POS transactions cannot establish real-world accuracy.

Primary references:
- https://www.statsmodels.org/stable/examples/notebooks/generated/statespace_forecasting.html
- https://arxiv.org/abs/2202.07282


## Earlier interval backtest result

The 79-material September 23-October 6 test contains 1,106 material-days.
Observed daily coverage: 94.58% model-based -> 95.48% calibrated.
Median per-material width decreases 48.47%; interval score improves for 57/79.
Coverage when usage occurs decreases from 87.39% to 85.67%, so narrower ranges
are not an improvement for every demand spike. Point forecasts, MAE and the
77.42% mean material MAPE remain unchanged. All figures are synthetic/seeded
backtests, not operational accuracy guarantees. Detailed results are in
generator/sarima_calibration/EVALUATION.md and interval_benchmark.csv.

## Current constraint and insight evaluation

On the same 79-material test, the updated constraints reduce mean material MAPE
from 77.42% to 76.41% and mean absolute period-total percentage error from 60.96%
to 60.11%. Overall daily coverage rises from 95.48% to 98.28%; coverage on the
349 days with usage rises from 85.67% to 94.56%. All CV MAE/MAPE/RMSE guards pass.
Point MAPE improves for 21 materials and worsens for 10; period-total absolute
error improves for 23 and worsens for 10.

This protection is more conservative: median per-material width is 71.22%
greater than the previous calibrated version. Median interval score worsens
34.75%, with only 26/79 materials improving that score. Higher coverage alone
is not evidence of more accurate or more efficient forecasts. The nominal target
remains 95%; positive-day coverage still falls slightly short in aggregate and
some individual materials remain unreliable. Evidence labels expose these limits.

These previously examined dates are a historical regression comparison, not a
new untouched prospective test. Generated/seeded inputs still need operational
validation. Full results, methodology and installation backups are stored in
generator/sarima_insights/EVALUATION.md, full_benchmark.csv and summary.json.
