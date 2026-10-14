# Isolated SARIMA test results

Tested the copied current implementation in a separate Python virtualenv. Installed packages were shared read-only. No production database was accessed or changed.

Input: 90 synthetic completed-POS days (July 16?October 13, 2026), real local catalog identities, and fixture inventory. Actual default SARIMA grid search, rolling validation and refit were executed; models were not mocked.

Checks: 13/13 passed. Backend POS extraction/result validation: 14/14 tests passed.

| Result | Value |
|---|---|
| Material | Alaska Classic Evaporated Filled Milk 370ml |
| Forecast period | October 14?20, 2026 |
| Forecast total | 10,440.97 ml |
| Validation MAE | 13.76 ml/day |
| Validation RMSE | 16.31 ml/day |
| Validation MAPE | 0.95% |
| SARIMA orders | [2, 1, 2] / [0, 1, 1, 7] |
| Training duration | 20.08 seconds |

These errors describe a deliberately regular synthetic fixture, not accuracy on real sales.

## Behavior checked

- PASS: POS liter-to-milliliter conversion
- PASS: New material absent from CSV catalog
- PASS: No completed POS coverage
- PASS: Partial current Philippine day
- PASS: Negative ledger consumption
- PASS: Consumption outside covered dates
- PASS: Partial-day exclusion independent of forecast cutoff
- PASS: Incompatible POS units excluded
- PASS: Actual full SARIMA grid training
- PASS: Seven calendar forecast days including weekend
- PASS: Finite ordered prediction intervals
- PASS: Constant unused enrolled material skipped
- PASS: POS-only training provenance

## Findings

- A new enrolled material absent from the CSV reference catalog is excluded. Enrollment alone is insufficient with the current implementation.
- Unused constant history is skipped without another model fallback.
- Current SARIMA.py reads historical CSV at import time. An initial test without that file failed before POS processing; copying the file allowed the unchanged script to run. Training audit still reports 90 POS days and zero CSV training days.
- 47 convergence warnings occurred during model search/refit. Finite output does not establish optimizer convergence; this test does not certify the selected model converged.
- Prediction interval coverage was not independently validated.

Detailed artifacts: summary.json, request.json, result.json and training.log.