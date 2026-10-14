# SARIMA forecasting

`SARIMA.py` is the forecasting implementation: daily aggregation, Box-Cox transformation, SARIMA grid search with rolling validation, full-history refit and model prediction intervals. Its standalone CSV viewer remains available.

The application calls `forecast_bridge.py`, which uses these same functions with completed POS ingredient consumption from the backend inventory checkout ledger. Voided/refunded orders, the current partial Philippine day and forecast-period observations are excluded. CSV training data is not used by the application, regardless of older training-source or portfolio environment settings.

Application forecasts cover calendar days, including weekends, with seven-day seasonality. The standalone script retains its business-day default. At least 60 recorded daily observations and varying usage are required; insufficient or constant histories are reported rather than using another forecasting model. Unknown POS calendar days retain the existing causal estimates and are marked as imputed; they do not count toward the recorded-day minimum.

Current stock comes from the live inventory snapshot. Catalog unit conversion and reorder points remain in use. Intervals are model estimates, without an independently calibrated coverage claim. Generate a new run to see this implementation; saved historical runs retain their original results.
