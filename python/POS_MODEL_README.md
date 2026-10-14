# Restored multi-model forecasting

Restored from the saved October 13, 2026 source snapshot. `FORECAST_PORTFOLIO=auto` enables per-material comparison of SARIMA, ETS, seasonal-naive, moving averages, intermittent-demand methods and eligible ensembles. Eligibility and validation determine which methods participate and which is selected.

The bridge defaults to `FORECAST_TRAINING_SOURCE=mixed`: compatible historical CSV plus completed POS consumption, with POS replacing overlapping dates. Set `FORECAST_TRAINING_SOURCE=pos` to require POS-only inputs. Current stock comes from the live inventory snapshot. Forecast and partial Philippine-day observations are excluded.

Your SARIMA-only files were preserved in `output/before-portfolio-restore-20261015`. Previously saved forecasts keep their results; generate a new run to use the restored implementation.
