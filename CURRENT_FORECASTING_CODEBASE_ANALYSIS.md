# Current forecasting snapshot analysis

Reviewed 11 October 2026 (Asia/Manila).

Source: `C:/Users/Robert/Downloads/current_forecasting_codebase/current_forecasting_codebase`.

## Overall conclusion

This snapshot is a substantially revised forecasting module. Its operational path uses completed POS consumption only, eighteen constrained candidate configurations, chronological validation, training-window selection, empirical daily interval calibration, persisted model reuse/refitting, and evidence-aware user notes. It remains a statistical time-series forecasting system, chiefly SARIMAX, with a labelled seasonal-naive baseline for constant histories. The reported holdout errors remain high, so architectural improvements should be distinguished from demonstrated predictive improvement.

The prior thesis draft and explanations of twelve candidates, CSV/POS operational merging, lowest-MAE-only selection, universally fixed log1p transformation, and mandatory full-history refitting are outdated for this snapshot.

## Verification performed

- Read the operational Python pipeline, model selection, interval calibration, model persistence, recommendation layer, backend scheduling and POS queries, frontend notes, and supplied verification reports.
- Independently ran all 59 Python tests: passed.
- Verified every one of the 263 files listed in MANIFEST.json against its recorded SHA-256: no mismatches.
- Independently recomputed aggregate MAPE, WAPE, and coverage from docs/holdout_comparison.json; they agree with its summary documentation.
- Counted 65 model JSON manifests. Hash integrity does not independently verify fitted-object contents or predictive validity.
- Did not deserialize supplied pickle artifacts, refit all models, reproduce the database holdout experiment, or rerun the reported 48 backend tests. Supplied reports of live database checks are historical evidence, not new checks performed in this review.
- No supplied source files were modified. Only this analysis document was added to the workspace.

## Current workflow

1. The Nest scheduler initiates an eligible seven-day run at Philippine midnight, with startup and minute-based catch-up/retry checks.
2. It reads active material stock and completed POS consumption in a repeatable-read database snapshot.
3. Checkout quantities are grouped by material, Philippine date, and recorded unit snapshot. Completed orders supply consumption; current partial days and forecast dates are excluded.
4. The Python worker defaults to FORECAST_TRAINING_SOURCE=pos. Generated CSV consumption is used only in explicit development mixed mode.
5. Operational history retains the latest uninterrupted sequence of covered POS calendar days. A gap discards earlier covered dates instead of inserting fabricated demand on unknown dates.
6. For each eligible catalog material, zero consumption is retained on covered dates without deductions. Compatible recorded units are converted to live units; missing recorded units fall back to catalog units with a warning.
7. The pipeline checks history length and start date, then reuses, refits, or searches a model as appropriate.
8. Nonconstant histories use constrained SARIMAX candidates. Constant histories use a labelled last-seven-day baseline.
9. Predictions receive model-based or empirically calibrated daily bounds, output checks, stock advice, and explanatory metadata.
10. The backend validates exactly seven sequential dates and atomically stores completed results. The interface displays saved estimates, comparisons, evidence status, and progress.

## Model configurations

`python/constrained_sarima.py::candidate_specs()` defines eighteen configurations, not the twelve-way Cartesian grid described previously:

| Family | Count | Settings |
|---|---:|---|
| Weekly seasonal AR with constant | 6 | Windows 182 days, 365 days, or all; log1p or scaled raw target; order (1,0,0); seasonal (1,0,0,7); trend c |
| Alternative weekly seasonal orders | 6 | Full history; log1p; orders (0,0,0), (1,0,0), (2,0,0), (0,1,0), (1,0,1), (2,1,1); seasonal (1,0,0,7); no deterministic trend |
| Weekday-regressor alternatives | 6 | Windows 182 days, 365 days, or all; log1p or scaled raw; order (1,0,0); seasonal (0,0,0,7); trend c; six weekday indicators |

Holiday regressors are constructed for every family, but columns constant within a fitting window are dropped because their effects cannot be estimated. Consequently, a candidate may have no fitted holiday coefficient. Weekday candidates represent weekly effects deterministically rather than with seasonal AR terms.

Recent windows use the last available observations up to their maximum length. When a history is shorter than a candidate's requested window, it uses available history, so differently labelled windows can produce equivalent fitting inputs.

Raw targets are divided by max(training mean, 1) and forecasts multiplied back by that scale. Log1p predictions use expm1 without explicit log-scale bias correction. The same transformation and nonnegative flooring apply during validation and forecasting.

Fits require at least sixty training observations, optimizer convergence, finite coefficients, stationary AR components, and invertible MA components. For a seven-day horizon without gaps, at least 67 variable observations are needed for one rolling validation fold, and 81 for all three. The bridge's sixty-day minimum alone does not guarantee a nonconstant fit can be validated. Unlike the older implementation, the constrained route has no 80/20 fallback when no rolling fold fits.

## Candidate selection and weighting

This code does not use a manually weighted average of historical demand. Coefficients are estimated by the model. Fold-level MAE and other diagnostics receive equal weight when averaged.

Default selection is a constrained sequence:

1. Calculate the smallest validation MAE among successful candidates.
2. Keep candidates with MAE no more than 10% above that minimum (plus a numerical epsilon).
3. Find the lowest selection MAPE within this eligible set; undefined percentage scores fall back to MAE when no eligible score is finite.
4. With VOLUME_ESTIMATION enabled, retain candidates whose selection MAPE and RMSE are no more than 10% above those of the reference MAPE candidate.
5. Rank that guarded subset by period-total usage error, breaking ties by RMSE and the reference error ordering.
6. Refit candidates in this final ranking and accept the first whose outputs pass range checks.

Period-total error is:

```text
100 × sum_over_folds(abs(predicted_period_total - actual_period_total))
    / sum_over_folds(actual_period_total)
```

This metric permits daily overestimates and underestimates to cancel within a period. It therefore measures total-volume error, while MAE and RMSE guard day-level performance. A 10% guard is a relative tolerance compared with another candidate; it does not mean error must be below 10%.

WAPE is 100 × total absolute error / total actual quantity within a material. Individual days contribute through their error amounts, and period totals normalize the result. This is an evaluation measure, not recency weighting. The supplied cross-material WAPE summary equally averages defined material WAPEs rather than pooling grams, litres, and pieces into one quantity.

MAPE ignores zero actual amounts. The current constrained SMAPE differs from the old helper: zero/zero pairs contribute zero and remain in the overall average denominator. For actual [0,10] and predicted [0,0], constrained SMAPE is 100%, whereas averaging only nonzero-denominator pairs would give 200%. Use the current formula in the paper. Selection MAPE can average only defined folds while reported average MAPE is null if any fold was undefined; separate metadata records the distinction.

## Interval calibration

The interval layer aims at nominal 95% pointwise daily coverage. It uses up to twelve retrospective calibration periods and five later testing periods under an earlier selected configuration. For a seven-day horizon with no gap, the plan requires at least 179 retained observations: sixty initial observations plus seventeen seven-day periods. Longer prediction gaps raise this requirement.

It scales absolute residuals by an uncertainty measure based on half the model interval width and a floor. A finite-sample quantile determines interval expansion in seven-step buckets. A positive-demand guard increases upper bounds to cover observed usage spikes; sparse positive samples use their observed maximum rather than claiming a validated positive-demand quantile. Zero-frequency logic can set lower bounds to zero.

Later evaluation follows rolling chronology: a period's residuals join calibration only after its interval has been issued and scored. Calibration backcasts overlap dates involved in selecting the configuration; they are not a strict disjoint split-conformal calibration dataset. Time dependence also undermines exchangeability assumptions. The source explicitly states that target coverage is not guaranteed.

The tested earlier configuration may differ from the latest production configuration. Metadata marks this and scopes validation to the earlier forecasting procedure. It should not be described as independent accuracy measurement of the exact final production model.

Daily upper bounds are summed only as a stock stress scenario. Their sum is not a simultaneous 95% bound on weekly total demand.

## Saved model lifecycle

- Unchanged compatible history: reuse the fitted artifact.
- Added days within twenty-eight days of configuration selection: refit the chosen specification, retaining its chosen window, and update intervals.
- Twenty-eight new calendar days, major changes in recent mean/positive frequency, history revisions, changed horizon, incompatible runtime/engine fingerprint, or forced retraining: search configurations again.
- A failed saved configuration can trigger one fresh search.
- Constant history: labelled seasonal-naive baseline, rather than fitting unidentified SARIMA coefficients.

Cache compatibility compares the historical prefix, horizon, Python/statsmodels versions, and hashes of specified engine files. A manifest hashes each pickle payload and constrains its resolved path. Hashing detects corruption relative to a manifest but is not authentication of an artifact from an untrusted author; supplied artifacts should only be loaded when their producer is trusted. Saved models from a later historical cutoff cannot be reused for an earlier replay.

Saving uses unique payload filenames and an atomic manifest replacement. Old payloads are not deleted, so repeated refits accumulate files. The attempted rollback guard is not locked across processes; Python worker use outside the serialized backend could still have cache races. The API scheduler itself serializes forecast claims.

## Inventory and explanatory features

The catalog supplies identities, units, and reorder points. It supplies neither safety stock nor lead time; these default to zero. Usable stock comes from the live snapshot, and missing stock remains unknown.

```text
purchase target buffer = max(safety stock, catalog reorder point)
purchase quantity = ceil(max(0, forecast total + target buffer - current stock))
reported reorder point = max(daily average × lead time + safety stock,
                             catalog reorder point)
```

Thus catalog reorder point now affects purchase quantity, unlike the old implementation. It functions as a desired residual stock buffer in this formula, not simply a threshold triggering an order. The worker receives the database material reorderPoint but uses the CSV catalog value in its policy construction; catalog synchronization matters.

The priority logic still labels missing records No Data, no purchase Healthy, first-two-day stockouts Critical, days three/four High, later stockouts Medium, and purchase needs without a within-period stockout Low. Purchases do not model pack sizes, expiry, delivery timing, or incoming orders.

Evidence insights classify results as limited, caution, or supported. Defaults require at least thirty tested dates, twenty positive-demand dates, WAPE at most 30%, short history gaps, sufficient daily/positive coverage, stable period coverage, and improvement over seasonal naive. These checks affect the explanatory status; a caution or limited result is still returned and can still generate purchasing advice.

The backend timeout is now 120 minutes. Progress telemetry reports completed materials, successful materials, stage, durations, and the current material. Estimated completion times are estimates, not guarantees. Product filters still display store-wide usage of associated ingredients.

## Supplied independent-week comparison

Training cutoff: 18 September 2026. Held-out week: 19-25 September 2026. Materials: 79. Daily points: 553. Observed positive-demand points: 170. Twenty-four materials have no positive test usage, so percentage scores are undefined for those materials.

| Measure | POS-only | Previous mixed-source | Seasonal naive |
|---|---:|---:|---:|
| Mean defined material MAPE | 77.10% | 76.16% | 82.92% |
| Mean defined material WAPE | 99.06% | 99.32% | 125.60% |
| Overall daily interval coverage | 98.37% | 98.92% | Not supplied |
| Positive-demand daily interval coverage | 94.71% | 96.47% | Not supplied |

POS-only MAE improved for 31 materials, tied for 31, and worsened for 17 versus mixed-source. The report records 37 materials beating seasonal naive on MAE. This comparison uses seeded POS data and one held-out week. I verified the stored summary arithmetic, not the experiment's end-to-end reproduction or actual operational collection provenance.

Interpretation: the POS-only method slightly improves mean WAPE but worsens mean MAPE relative to mixed-source. The large point errors require attention. Coverage above 95% overall coexists with positive-demand coverage below 95%; abundant zeros and wide ranges can make overall coverage appear strong. Neither high interval coverage nor successful software checks establishes high point accuracy or purchasing savings.

## Concrete remaining issues

1. Coverage derives from order dates, rather than an explicit store-open/closed/import-complete calendar. A real trading day with no orders can become an unknown gap and discard useful older history. Add an authoritative daily coverage source before treating such dates as recorded zero demand.
2. Materials are assigned zeros for the entire retained segment even if introduced recently; material creation/activation dates are not considered in operational_history.py. This can overstate the available historical exposure of a new ingredient.
3. Legacy missing unit snapshots require a catalog assumption. The provided verification reports say existing ledger records lack snapshots; catalog changes could misinterpret old quantities.
4. The old standalone undefined TOP10_FILE reference remains in InventoryRecommendation.py. The web path imports build_report and avoids this entry-point defect.
5. ForecastNotes.tsx explains simple MAE ranking only when selectionMetric equals mae, and its detailed log1p explanation tests a legacy transformation label. Current constrained selections generally use a different criterion string and transformation label. Stored metadata is richer than the per-ingredient prose; notes should explain guarded total-volume selection and both current transforms.
6. New history/refits retain selection diagnostics from the previous full search; lifecycle dates explain that distinction. These are not newly measured selection errors on each refit.
7. Three-year training is supported only if that much consecutive eligible POS history exists, and candidate selection may choose 182 or 365 days instead of full history. Generated three-year CSV data is not the default production training source.

## Suggested updated thesis paragraph

The forecasting module uses completed point-of-sale ingredient consumption to construct daily raw-material time series over the latest uninterrupted covered period. For nonconstant histories, it evaluates eighteen SARIMAX configurations that vary training-window length, transformation, model order, and calendar regressors. Chronological validation applies relative MAE, MAPE, and RMSE guards before ranking eligible candidates by period-total consumption error. Accepted configurations produce seven-calendar-day estimates with model-based or retrospectively calibrated daily prediction bounds. Compatible saved models are reused or refitted as new observations become available, while constant histories use a labelled seasonal-naive baseline. The system also records training provenance, validation evidence, model lifecycle, and forecast limitations to support user interpretation and inventory planning.
