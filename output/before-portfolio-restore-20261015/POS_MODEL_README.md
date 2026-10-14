# Completed POS sales ? SARIMA

The Nest forecasting service reads completed checkout ingredient usage in a consistent database snapshot, grouped by Philippine calendar date and material. `operational_history.py` validates date coverage and converts snapshot units. `forecast_bridge.py` then calls the edited `SARIMA.py` directly. See `SARIMA_DATA_README.md` for training requirements and behavior.
