"""
===============================================================================
SARIMA DEMAND FORECASTING SYSTEM
===============================================================================

Author      : Robert
Model       : SARIMA
Forecast    : Raw Material-Level Demand Forecasting
Dataset     : cafe_raw_material_daily_consumption.csv

Description
-----------
This system automatically trains a SARIMA forecasting model for every product,
evaluates each model, and forecasts the next 7 days of demand.

Workflow
--------
1. Load transaction dataset
2. Aggregate daily sales
3. Build continuous daily time series
4. Transform data using Box-Cox
5. Train SARIMA models
6. Evaluate model performance
7. Forecast future demand
8. Store trained models
9. Interactive product viewer

===============================================================================
"""

# =============================================================================
# IMPORTS
# =============================================================================

import warnings
warnings.filterwarnings("ignore")

import argparse
import itertools
import time
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import holidays

from scipy.stats import boxcox
from scipy.special import inv_boxcox

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error
)

from statsmodels.tsa.statespace.sarimax import SARIMAX


# =============================================================================
# CONFIGURATION
# =============================================================================

CONFIG = {
    # Dataset
    "DATASET": "cafe_raw_material_daily_consumption.csv",

    # Forecast horizon
    "FORECAST_DAYS": 7,

    # Automatic rerun interval for --schedule mode.
    "RERUN_DAYS": 7,

    # Minimum observations required
    # PATCH: raised from 30 -> 60. Rolling CV (below) needs enough history
    # for CV_FOLDS x CV_HORIZON held-out days plus a reasonable amount of
    # training data before the first fold; 30 was too tight once cross-
    # validation is in play (materials below this just fall back to a
    # single 80/20 split - see train_sarima()).
    "MIN_HISTORY": 60,

    # Train/Test Split
    "TRAIN_RATIO": 0.80,

    # Seasonal Period
    # PATCH: this business only operates Mon-Fri (verified: 786 rows in
    # sales.csv exactly match the number of weekdays between the min/max
    # dates, zero Saturday/Sunday rows). The weekly cycle is therefore
    # 5 business days, not 7 calendar days - see build_daily_series().
    "SEASON_LENGTH": 5,

    # Country used to flag holidays in the forecast horizon (must match
    # how the historical 'holiday' column in sales.csv was populated -
    # it contains real PH public holidays, e.g. "Araw ng Kagitingan",
    # "Ninoy Aquino Day", "EDSA People Power Revolution Anniversary").
    "HOLIDAY_COUNTRY": "PH",

    # Exogenous regressors passed to SARIMAX. is_holiday is included
    # because, empirically, mean daily usage on holidays is roughly 2x
    # a normal day for several raw materials - a plain SARIMA model has
    # no way to see that spike coming, which was inflating MAPE.
    "EXOG_COLS": ["is_holiday"],

    # Grid Search
    "P": range(0, 3),
    "D": [1],
    "Q": range(0, 3),

    "SP": range(0, 2),
    # PATCH: was fixed at [1] (always seasonally differenced). Forcing
    # this on every single raw material risks over-differencing series
    # that don't need it (a classic symptom is an MA coefficient that
    # collapses to ~-1, which makes forecasts unstable). Let the grid
    # search choose 0 or 1 per series instead.
    "SD": [0, 1],
    "SQ": range(0, 2),

    # PATCH (new): rolling-window (walk-forward) validation instead of a
    # single fixed 80/20 split. A single split means whichever (order,
    # seasonal) combo happens to fit that one held-out window best gets
    # picked - with a large grid, that's prone to picking a combo that
    # got lucky on that specific window rather than one that generalizes
    # (a multiple-comparisons problem). Testing each combo across several
    # rolling windows and averaging the score is a much more reliable way
    # to select parameters, at the cost of CV_FOLDS times the runtime.
    #
    # CV_HORIZON matches FORECAST_DAYS on purpose: it validates each
    # candidate model at the exact horizon it will actually be used to
    # forecast, which is the most meaningful test of real-world accuracy.
    "CV_FOLDS": 3,
    "CV_HORIZON": None,  # None -> defaults to FORECAST_DAYS at runtime
}


# =============================================================================
# LOAD DATASET
# =============================================================================

def load_dataset():
    """
    Load transaction dataset.

    Returns
    -------
    pandas.DataFrame
    """
    dataset_path = Path(__file__).resolve().parent / CONFIG["DATASET"]
    df = pd.read_csv(dataset_path)
    required_columns = {
        "date",
        "product",
        "raw_material",
        "quantity_used",
        "unit"
    }
    missing_columns = required_columns.difference(df.columns)
    if missing_columns:
        raise ValueError(
            "cafe_raw_material_daily_consumption.csv is missing required columns: "
            + ", ".join(sorted(missing_columns))
        )
    df = df.rename(
        columns={
            "date": "transaction_date",
            "product": "product_detail",
            "quantity_used": "transaction_qty"
        }
    )
    df["transaction_date"] = pd.to_datetime(
        df["transaction_date"],
        errors="raise"
    )
    df["transaction_qty"] = pd.to_numeric(
        df["transaction_qty"],
        errors="raise"
    )
    return df


# =============================================================================
# AGGREGATE DAILY SALES
# =============================================================================

def aggregate_daily_sales(raw_df):
    """
    Aggregate transaction-level records into
    daily raw-material usage.

    Returns
    -------
    pandas.DataFrame
    """
    group_columns = [
        "raw_material",
        "unit"
    ]
    daily = (
         raw_df
        .groupby(
            group_columns +
            [raw_df["transaction_date"].dt.floor("D")]
        )["transaction_qty"]
        .sum()
        .reset_index()
        .rename(
               columns={
                "transaction_qty": "qty"
            }
        )
    )
    return daily


# =============================================================================
# BUILD DAILY TIME SERIES
# =============================================================================

def build_daily_series(
    daily_df,
    raw_material,
    unit,
    holiday_lookup
):
    """
    Create a continuous BUSINESS-DAY demand series.

    PATCH: the original version reindexed on every calendar day
    (freq="D"), which fabricates ~300 fake "0 units used" Saturday/Sunday
    rows for a business that has no weekend transactions at all. Those
    fake zeros distorted the weekly seasonal pattern (a real 5-day cycle
    was being modelled as a 7-day cycle with 2 guaranteed zeros) and
    contributed to the high MAPE. Using pd.bdate_range instead only fills
    in genuinely missing business days (e.g. a data gap), not weekends
    that were never open to begin with.

    Also attaches the is_holiday exogenous flag for each date, used later
    as a SARIMAX regressor.

    Parameters
    ----------
    daily_df : DataFrame
    raw_material : str
    unit : str
    holiday_lookup : pandas.Series
        Output of build_holiday_lookup(), indexed by date.

    Returns
    -------
    DataFrame
    """
    series = daily_df[
        (daily_df["raw_material"] == raw_material)
        & (daily_df["unit"] == unit)
    ]
    series = (
        series
        .set_index("transaction_date")
          .sort_index()[["qty"]]
    )
    date_range = pd.bdate_range if CONFIG.get("BUSINESS_DAYS_ONLY", True) else pd.date_range
    full_dates = date_range(
        start=series.index.min(),
        end=series.index.max()
    )
    series = series.reindex(
        full_dates,
        fill_value=0
    )
    series.index.name = "Date"
    series = series.reset_index()
    series["is_holiday"] = (
        series["Date"]
        .map(holiday_lookup)
        .fillna(0)
        .astype(int)
    )
    return series


# =============================================================================
# HOLIDAY EXOGENOUS REGRESSOR
# =============================================================================

def build_holiday_lookup(raw_df):
    """
    PATCH (new function): map each historical date to whether it was a
    holiday, straight from cafe_raw_material_daily_consumption.csv's own 'holiday' column (which already
    contains real Philippine public holidays). This becomes the is_holiday
    exogenous regressor - see CONFIG["EXOG_COLS"] and CONFIG note above on
    why it's needed: holiday-day usage is roughly double a normal day for
    several raw materials, and a plain SARIMA model (no exog) can't see
    that coming.

    Returns
    -------
    pandas.Series indexed by date, values 0/1.
    """
    if "holiday" not in raw_df.columns:
        print(
            "Warning: no 'holiday' column found in the dataset - "
            "is_holiday exog will be all zero."
        )
        dates = raw_df["transaction_date"].dt.floor("D").unique()
        return pd.Series(0, index=pd.DatetimeIndex(dates), name="is_holiday")

    lookup = (
        raw_df[["transaction_date", "holiday"]]
        .assign(transaction_date=lambda d: d["transaction_date"].dt.floor("D"))
        .drop_duplicates(subset="transaction_date")
        .set_index("transaction_date")["holiday"]
        .eq("YES")
        .astype(int)
        .rename("is_holiday")
    )
    return lookup


def future_holiday_flags(future_dates, country=None):
    """
    PATCH (new function): build the is_holiday exog for forecast dates
    (beyond the observed data) using the official public holiday calendar
    for `country`. This keeps future forecasts consistent with how the
    historical 'holiday' column was populated, instead of silently
    assuming every future day is a non-holiday.

    Parameters
    ----------
    future_dates : DatetimeIndex
    country : str
        ISO country code, e.g. "PH". Defaults to CONFIG["HOLIDAY_COUNTRY"].

    Returns
    -------
    pandas.Series indexed by date, values 0/1.
    """
    if country is None:
        country = CONFIG["HOLIDAY_COUNTRY"]
    years = sorted(set(future_dates.year))
    country_holidays = holidays.country_holidays(country, years=years)
    return pd.Series(
        [1 if d.date() in country_holidays else 0 for d in future_dates],
        index=future_dates,
        name="is_holiday"
    )


# =============================================================================
# BOX-COX TRANSFORMATION
# =============================================================================

def make_stationary(series_df):
    """
    Apply Box-Cox transformation.

    Returns
    -------
    dict

        {
            "series": transformed_dataframe,
            "lambda": lambda_value
        }
    """
    transformed = series_df.copy()
    transformed["qty_shifted"] = transformed["qty"] + 1
    fixed_lambda = CONFIG.get("BOXCOX_LAMBDA")
    if fixed_lambda is None:
        transformed["qty_boxcox"], lam = boxcox(transformed["qty_shifted"])
    else:
        lam = float(fixed_lambda)
        transformed["qty_boxcox"] = boxcox(transformed["qty_shifted"], lmbda=lam)
    return {
        "series": transformed,
        "lambda": lam
    }


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def calculate_mape(actual, predicted):
    """
    Mean Absolute Percentage Error.

    NOTE: MAPE divides by the actual value, so it blows up whenever a
    day's true usage is small - which happens a lot in this dataset
    (raw-material usage is fairly noisy day to day, coefficient of
    variation ~0.35-0.45 for most materials). A MAPE of 30-40% here can
    reflect that noise floor rather than a broken model. calculate_smape()
    below is reported alongside it as a more stable cross-check.
    """
    actual = np.asarray(actual)
    predicted = np.asarray(predicted)
    mask = actual != 0
    return (
        np.mean(
            np.abs(
                (
                    actual[mask]
                    -
                    predicted[mask]
                )
                /
                actual[mask]
            )
        )
        * 100
    )


def calculate_smape(actual, predicted):
    """
    Symmetric MAPE: bounded 0-200%, doesn't explode when `actual` is
    near zero the way plain MAPE does. Use this as a sanity check
    whenever MAPE looks unexpectedly high.
    """
    actual = np.asarray(actual)
    predicted = np.asarray(predicted)
    denom = np.abs(actual) + np.abs(predicted)
    mask = denom != 0
    return (
        np.mean(
            2 * np.abs(predicted[mask] - actual[mask]) / denom[mask]
        )
        * 100
    )

# =============================================================================
# LOAD DATA
# =============================================================================

# Dataset loading is explicit so importing the model does not read files.

# =============================================================================
# VISUALIZATION
# =============================================================================

def plot_demand(series_df, title):
    """
    Plot historical product demand.
    """
    fig = px.line(
        series_df,
        x="Date",
        y="qty",
        title=title,
        labels={
            "qty": "Units Sold"
        }
    )

    fig.update_layout(
        template="simple_white",
        width=950,
        height=450,
        title_x=0.5,
        font=dict(size=15)
    )
    fig.show()


# =============================================================================
# PLOT BOX-COX TRANSFORMED SERIES
# =============================================================================

def plot_stationary(stationary_df, title):
    """
    Plot Box-Cox transformed demand.
    """
    fig = px.line(
        stationary_df,
        x="Date",
        y="qty_boxcox",
        title=title,
        labels={
            "qty_boxcox": "Box-Cox Demand"
        }
    )

    fig.update_layout(
        template="simple_white",
        width=950,
        height=450,
        title_x=0.5,
        font=dict(size=15)
    )
    fig.show()


# =============================================================================
# TRAIN / TEST FORECAST
# =============================================================================

def plot_forecasts(result, product):
    """
    Plot training data,
    actual demand,
    and SARIMA prediction.
    """
    train = result["train"]
    test = result["test"]
    predictions = result["predictions"]
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=train["Date"],
            y=train["qty"],
            mode="lines",
            name="Training"
        )
    )

    fig.add_trace(
        go.Scatter(
            x=test["Date"],
            y=test["qty"],
            mode="lines",
            name="Actual"
        )
    )

    fig.add_trace(
        go.Scatter(
            x=test["Date"],
            y=predictions,
            mode="lines",
            name="Forecast"
        )
    )

    fig.update_layout(
        template="simple_white",
        width=1000,
        height=500,
        title=f"SARIMA Validation Forecast - {product}",
        title_x=0.5,
        xaxis_title="Date",
        yaxis_title="Units Sold"
    )
    fig.show()


# =============================================================================
# FUTURE FORECAST
# =============================================================================

def plot_future_forecast(future_df, product):
    """
    Plot 7-day demand forecast with
    95% confidence interval.
    """
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=future_df["Date"],
            y=future_df["Forecast"],
            mode="lines+markers",
            name="Forecast"
        )
    )

    fig.add_trace(
        go.Scatter(
            x=future_df["Date"],
            y=future_df["Upper95"],
            mode="lines",
            line=dict(width=0),
            showlegend=False
        )
    )

    fig.add_trace(
        go.Scatter(
            x=future_df["Date"],
            y=future_df["Lower95"],
            mode="lines",
            fill="tonexty",
            name="95% Confidence Interval"
        )
    )

    fig.update_layout(
        template="simple_white",
        width=1000,
        height=500,
        title=f"Next {CONFIG['FORECAST_DAYS']} Days Forecast - {product}",
        title_x=0.5,
        xaxis_title="Date",
        yaxis_title="Forecasted Demand"
    )
    fig.show()


# =============================================================================
# PRINT FUTURE FORECAST
# =============================================================================

def print_future_forecast(future_df, product):
    """
    Display forecast table.
    """
    print("\n" + "=" * 70)
    print(f"{product}")
    print("=" * 70)
    print(
        future_df[
            [
                "Date",
                "Forecast",
                "Lower95",
                "Upper95"
            ]
        ].to_string(index=False)
    )
    print("=" * 70)


# =============================================================================
# MODEL EVALUATION
# =============================================================================

def evaluate_model(actual, predicted):
    """
    Compute forecasting metrics.
    """
    mae = mean_absolute_error(
        actual,
        predicted
    )

    rmse = np.sqrt(
        mean_squared_error(
            actual,
            predicted
        )
    )

    mape = calculate_mape(
        actual,
        predicted
    )

    confidence = max(
        0,
        100 - mape
    )

    results = {
        "MAE": round(mae, 2),
        "RMSE": round(rmse, 2),
        "MAPE": round(mape, 2),
        "Confidence": round(confidence, 2)
    }
    print("\n" + "=" * 70)
    print("MODEL PERFORMANCE")
    print("=" * 70)
    print(f"MAE         : {results['MAE']}")
    print(f"RMSE        : {results['RMSE']}")
    print(f"MAPE        : {results['MAPE']}%")
    print(f"Confidence  : {results['Confidence']}%")
    print("=" * 70)

    return results

# =============================================================================
# SARIMA MODEL TRAINING
# =============================================================================

def train_sarima(stationary_result):
    """
    Train a SARIMA model using rolling-window (walk-forward) cross-
    validation instead of a single fixed train/test split.

    PATCH: the original version picked whichever (order, seasonal) combo
    happened to score lowest MAPE on ONE fixed 80/20 split. With a large
    grid (dozens of combos), that's prone to picking a combo that just
    got lucky on that particular held-out window rather than one that
    actually generalizes - a classic multiple-comparisons problem, and
    it gets worse the more combos you try.

    Instead, this builds CONFIG["CV_FOLDS"] expanding-window folds, each
    validated on a CONFIG["CV_HORIZON"]-day window (defaults to
    FORECAST_DAYS, so models are validated at the same horizon they'll
    actually be used to forecast). Every (order, seasonal) combo is
    scored by its MAPE *averaged across all folds*, which is a much more
    reliable signal of real generalization than a single split - at the
    cost of roughly CV_FOLDS times the fitting time.

    If there isn't enough history for the requested folds, this falls
    back to a single 80/20 split (same behaviour as before) and says so.

    Model selection criterion:
        Lowest average MAPE across folds

    Returns
    -------
    dict
        Contains the trained model, predictions, metrics (averaged
        across folds), per-fold breakdown, and best SARIMA parameters.
    """
    series_df = stationary_result["series"]
    lam = stationary_result["lambda"]
    exog_cols = CONFIG["EXOG_COLS"]

    n = len(series_df)
    horizon = CONFIG["CV_HORIZON"] or CONFIG["FORECAST_DAYS"]
    n_folds = CONFIG["CV_FOLDS"]

    # ==========================================================
    # Build rolling (expanding-window) validation folds.
    # Each fold's test window is `horizon` days, folds are laid out
    # back-to-back ending at the last observation, and each fold's
    # training data grows to include everything before its test window.
    # ==========================================================

    fold_specs = []
    for f in reversed(range(n_folds)):
        train_end = n - horizon * (f + 1)
        test_end = train_end + horizon
        if train_end >= 30 and test_end <= n:
            fold_specs.append((train_end, test_end))

    used_cv = True
    if not fold_specs:
        # Not enough history for rolling CV - fall back to the original
        # single 80/20 split so short series can still be modelled.
        used_cv = False
        split = int(n * CONFIG["TRAIN_RATIO"])
        fold_specs = [(split, n)]
        print(
            "\nNot enough history for rolling CV "
            f"({n_folds} folds x {horizon}-day horizon) - "
            "falling back to a single 80/20 split.\n"
        )
    else:
        print(
            f"\nRunning rolling-window validation: "
            f"{len(fold_specs)} fold(s) x {horizon}-day horizon...\n"
        )

    # ==========================================================
    # Parameter Grid
    # ==========================================================

    pdq = list(

        itertools.product(
            CONFIG["P"],
            CONFIG["D"],
            CONFIG["Q"]
        )
    )

    seasonal_pdq = [
        (
            p,
            d,
            q,
            CONFIG["SEASON_LENGTH"]
        )

        for p, d, q in itertools.product(
            CONFIG["SP"],
            CONFIG["SD"],
            CONFIG["SQ"]
        )
    ]

    best = {
        "order": None,
        "seasonal": None,
        "fold_metrics": None,
        "metrics": {
            "mae": np.inf,
            "rmse": np.inf,
            "mape": np.inf,
            "smape": np.inf,
            "aic": np.inf,
            "bic": np.inf
        }
    }
    total_models = len(pdq) * len(seasonal_pdq)
    total_fits = total_models * len(fold_specs)
    current = 0
    print(f"Searching SARIMA models ({total_fits} total fits)...\n")

    # ==========================================================
    # Grid Search (each combo scored across all CV folds)
    # ==========================================================

    for order in pdq:
        for seasonal in seasonal_pdq:
            current += 1
            print(
                f"\rTesting Model "
                f"{current}/{total_models}",
                end=""
            )

            fold_metrics = []
            fold_failed = False

            for train_end, test_end in fold_specs:

                train = series_df.iloc[:train_end]
                test = series_df.iloc[train_end:test_end]
                train_exog = train[exog_cols].astype(float)
                test_exog = test[exog_cols].astype(float)

                try:

                    # Fit the transformation on this fold only to avoid validation leakage.
                    fixed_lambda = CONFIG.get("BOXCOX_LAMBDA")
                    if fixed_lambda is None:
                        train_boxcox, fold_lambda = boxcox(train["qty"] + 1)
                    else:
                        fold_lambda = float(fixed_lambda)
                        train_boxcox = boxcox(train["qty"] + 1, lmbda=fold_lambda)
                    model = SARIMAX(
                        train_boxcox,
                        exog=train_exog,
                        order=order,
                        seasonal_order=seasonal,
                        enforce_stationarity=False,
                        enforce_invertibility=False
                    ).fit(disp=False)

                    forecast_boxcox = model.forecast(
                        len(test),
                        exog=test_exog
                    )
                    predictions = inv_boxcox(
                        forecast_boxcox,
                        fold_lambda
                    ) - 1
                    predictions = np.clip(
                        predictions,
                        0,
                        None
                    )

                    mae = mean_absolute_error(
                        test["qty"],
                        predictions
                    )
                    rmse = np.sqrt(
                        mean_squared_error(
                            test["qty"],
                            predictions
                        )
                    )
                    mape = calculate_mape(
                        test["qty"],
                        predictions
                    )
                    smape = calculate_smape(
                        test["qty"],
                        predictions
                    )

                    fold_metrics.append({
                        "mae": mae,
                        "rmse": rmse,
                        "mape": mape,
                        "smape": smape,
                        "aic": model.aic,
                        "bic": model.bic,
                        "model": model,
                        "train": train,
                        "test": test,
                        "predictions": predictions
                    })

                except Exception:
                    fold_failed = True
                    break

            if fold_failed or not fold_metrics:
                continue

            # ----------------------------------------------
            # Score this combo by its average MAPE across folds
            # ----------------------------------------------

            avg_metrics = {
                key: np.mean([fold[key] for fold in fold_metrics])
                for key in ["mae", "rmse", "mape", "smape", "aic", "bic"]
            }

            if avg_metrics["mape"] < best["metrics"]["mape"]:
                best["order"] = order
                best["seasonal"] = seasonal
                best["metrics"] = avg_metrics
                best["fold_metrics"] = fold_metrics

    print("\n")
    print("=" * 70)
    print("BEST SARIMA MODEL" + (" (avg across folds)" if used_cv else ""))
    print("=" * 70)
    print(f"Order           : {best['order']}")
    print(f"Seasonal Order  : {best['seasonal']}")
    print(f"AIC             : {best['metrics']['aic']:.2f}")
    print(f"BIC             : {best['metrics']['bic']:.2f}")
    print(f"MAE             : {best['metrics']['mae']:.2f}")
    print(f"RMSE            : {best['metrics']['rmse']:.2f}")
    print(f"MAPE            : {best['metrics']['mape']:.2f}%")
    print(f"SMAPE           : {best['metrics']['smape']:.2f}%")

    if used_cv and len(best["fold_metrics"]) > 1:
        print("-" * 70)
        print("Per-fold breakdown:")
        for i, fold in enumerate(best["fold_metrics"], start=1):
            print(
                f"  Fold {i}: "
                f"MAPE = {fold['mape']:.2f}%  "
                f"SMAPE = {fold['smape']:.2f}%  "
                f"({fold['test']['Date'].min().date()} to "
                f"{fold['test']['Date'].max().date()})"
            )
    print("=" * 70)

    # The most recent fold is used for the "validation" train/test/
    # predictions returned below (e.g. for plot_forecasts()) since it's
    # the closest analogue to the original single-split behaviour and
    # covers the most recent, most relevant period.
    last_fold = best["fold_metrics"][-1]

    return {
        "model": last_fold["model"],
        "train": last_fold["train"],
        "test": last_fold["test"],
        "predictions": last_fold["predictions"],
        "order": best["order"],
        "seasonal": best["seasonal"],
        "metrics": best["metrics"],
        "fold_metrics": best["fold_metrics"],
        "used_cv": used_cv,
        "exog_cols": exog_cols
    }


# =============================================================================
# MODEL EVALUATION
# =============================================================================

def evaluate_training(result):
    """
    Display evaluation metrics from the
    selected SARIMA model.
    """
    metrics = result["metrics"]
    confidence = max(
        0,
        100 - metrics["mape"]
    )
    print("\n" + "=" * 70)
    print("MODEL PERFORMANCE")
    print("=" * 70)
    print(f"MAE         : {metrics['mae']:.2f}")
    print(f"RMSE        : {metrics['rmse']:.2f}")
    print(f"MAPE        : {metrics['mape']:.2f}%")
    print(f"Confidence  : {confidence:.2f}%")
    print("=" * 70)

    return confidence

# =============================================================================
# RETRAIN MODEL USING ENTIRE DATASET
# =============================================================================

def fit_full_model(stationary_result, training_result):
    """
    Retrain the best SARIMA model using the entire dataset.

    Parameters
    ----------
    stationary_result : dict
        Output of make_stationary()

    training_result : dict
        Output of train_sarima()

    Returns
    -------
    SARIMAXResults
    """
    series_df = stationary_result["series"]
    exog_cols = training_result.get("exog_cols", CONFIG["EXOG_COLS"])

    model = SARIMAX(
        series_df["qty_boxcox"],
        exog=series_df[exog_cols].astype(float),
        order=training_result["order"],
        seasonal_order=training_result["seasonal"],
        enforce_stationarity=False,
        enforce_invertibility=False
    ).fit(disp=False)

    return model


# =============================================================================
# FUTURE FORECAST
# =============================================================================

def forecast_future(
    model,
    stationary_result,
    horizon=None,
    exog_cols=None
):
    """
    Forecast future demand with a 95% confidence interval.

    PATCH: future dates are now business days (pd.bdate_range) to match
    the business-day training series, and an is_holiday exog is built for
    those future dates from the real PH holiday calendar (future_holiday_
    flags()) so the model can anticipate holiday spikes instead of
    assuming every forecast day is a normal day.

    Returns
    -------
    pandas.DataFrame
    """

    if horizon is None:
        horizon = CONFIG["FORECAST_DAYS"]
    if exog_cols is None:
        exog_cols = CONFIG["EXOG_COLS"]

    series_df = stationary_result["series"]
    lam = stationary_result["lambda"]

    # ----------------------------------------------------------
    # Future Dates (business days only, consistent with training)
    # ----------------------------------------------------------

    last_date = series_df["Date"].max()

    date_range = pd.bdate_range if CONFIG.get("BUSINESS_DAYS_ONLY", True) else pd.date_range
    future_dates = date_range(
        start=last_date + pd.Timedelta(days=1),
        periods=horizon
    )

    future_exog = (
        future_holiday_flags(future_dates)
        .to_frame()
        .reindex(columns=exog_cols, fill_value=0)
        .astype(float)
    )
    future_exog.index = range(len(future_exog))

    forecast_result = model.get_forecast(
        steps=horizon,
        exog=future_exog
    )

    # ----------------------------------------------------------
    # Forecast (Box-Cox scale)
    # ----------------------------------------------------------

    forecast_boxcox = forecast_result.predicted_mean

    confidence = forecast_result.conf_int(alpha=0.05)

    # ----------------------------------------------------------
    # Convert back to original scale
    # ----------------------------------------------------------

    forecast = inv_boxcox(
        forecast_boxcox,
        lam
    ) - 1

    lower = inv_boxcox(
        confidence.iloc[:, 0],
        lam
    ) - 1

    upper = inv_boxcox(
        confidence.iloc[:, 1],
        lam
    ) - 1

    forecast = np.clip(
        forecast,
        0,
        None
    )

    lower = np.clip(
        lower,
        0,
        None
    )

    upper = np.clip(
        upper,
        0,
        None
    )

    future_df = pd.DataFrame({

        "Date": future_dates,

        "Forecast": np.round(
            forecast,
            2
        ),

        "Lower95": np.round(
            lower,
            2
        ),

        "Upper95": np.round(
            upper,
            2
        )

    })
    return future_df


# =============================================================================
# DISPLAY FORECAST TABLE
# =============================================================================

def print_future_forecast(
    future_df,
    product
):
    """
    Display the future forecast table.
    """

    print("\n" + "=" * 70)
    print(f"7-Day Forecast : {product}")
    print("=" * 70)
    print(
        future_df.to_string(
            index=False
        )
    )
    print("=" * 70)


# =============================================================================
# SAVE FORECAST
# =============================================================================

def save_forecast_csv(
    future_df,
    product
):
    """
    Save forecast to CSV.

    PATCH: `product` here is actually the forecast_database key, formatted
    as "RawMaterial | unit" (e.g. "Egg | pcs"). The old version only
    replaced spaces with underscores, so the '|' passed straight through
    into the filename - which Windows rejects outright (OSError: Invalid
    argument), since \\ / : * ? " < > | are all illegal in Windows
    filenames. Every one of those characters is now stripped/replaced
    before the file is written, on every OS.
    """

    answer = input(
        "\nSave forecast to CSV? (Y/N): "
    ).strip().upper()

    if answer != "Y":
        return

    safe_name = product.replace(" ", "_")
    for char in ["|", "\\", "/", ":", "*", "?", '"', "<", ">"]:
        safe_name = safe_name.replace(char, "")
    safe_name = safe_name.strip("_")
    while "__" in safe_name:
        safe_name = safe_name.replace("__", "_")

    filename = safe_name + "_forecast.csv"

    future_df.to_csv(
        filename,
        index=False
    )
    print(f"\nForecast saved as '{filename}'")


# =============================================================================
# PLOT FUTURE FORECAST
# =============================================================================

def plot_future_forecast(
    future_df,
    product
):
    """
    Plot the future demand forecast
    with a 95% confidence interval.
    """
    fig = go.Figure()

    # ----------------------------------------------------------
    # Upper Confidence Interval
    # ----------------------------------------------------------

    fig.add_trace(
        go.Scatter(
            x=future_df["Date"],
            y=future_df["Upper95"],
            mode="lines",
            line=dict(width=0),
            showlegend=False
        )
    )

    # ----------------------------------------------------------
    # Lower Confidence Interval
    # ----------------------------------------------------------

    fig.add_trace(
        go.Scatter(
            x=future_df["Date"],
            y=future_df["Lower95"],
            mode="lines",
            fill="tonexty",
            name="95% Confidence Interval"
        )
    )

    # ----------------------------------------------------------
    # Forecast Line
    # ----------------------------------------------------------

    fig.add_trace(
        go.Scatter(
            x=future_df["Date"],
            y=future_df["Forecast"],
            mode="lines+markers",
            name="Forecast"
        )
    )

    fig.update_layout(
        template="simple_white",
        width=1000,
        height=500,
        title=f"{CONFIG['FORECAST_DAYS']}-Day Demand Forecast - {product}",
        title_x=0.5,
        xaxis_title="Date",
        yaxis_title="Forecasted Units"
    )
    fig.show()


# =============================================================================
# COMPLETE FORECAST PIPELINE
# =============================================================================

def generate_forecast(
    daily_df,
    raw_material,
    unit,
    holiday_lookup
):
    """
    Complete forecasting workflow for a single product.

    Returns
    -------
    dict
    """
    history = build_daily_series(
        daily_df,
        raw_material,
        unit,
        holiday_lookup
    )
    stationary = make_stationary(
        history
    )
    training = train_sarima(
        stationary
    )
    full_model = fit_full_model(
        stationary,
        training
    )
    future = forecast_future(
        full_model,
        stationary,
        exog_cols=training["exog_cols"]
    )

    return {
        "history": history,
        "stationary": stationary,
        "training": training,
        "model": full_model,
        "forecast": future
    }

# =============================================================================
# BUILD FORECAST DATABASE
# =============================================================================

def forecast_all_products(daily_df, holiday_lookup):
    """
    Train SARIMA models for every raw material in sales.csv.

    Returns
    -------
    dict

        {
            raw_material_name : {

                history
                stationary
                training
                model
                forecast

            }

        }
    """

    forecast_database = {}

    # ----------------------------------------------------------
    # Count raw-material series
    # ----------------------------------------------------------

    series_keys = (
        daily_df[
            ["raw_material", "unit"]
        ]
        .drop_duplicates()
        .sort_values(
            ["raw_material", "unit"]
        )
        .itertuples(index=False, name=None)
    )
    series_keys = list(series_keys)
    total_products = len(series_keys)

    print("\n")
    print("=" * 70)
    print("BUILDING FORECAST DATABASE")
    print("=" * 70)
    print(f"Raw Materials    : {total_products}")
    print("=" * 70)

    completed = 0
    skipped = 0

    # ----------------------------------------------------------
    # Train Every Raw Material
    # ----------------------------------------------------------

    for raw_material, unit in series_keys:
        completed += 1

        print(

            f"[{completed}/{total_products}] "
            f"{raw_material} ({unit})",
            end=""
        )

        try:

            # ----------------------------------------------
            # Generate Forecast
            # ----------------------------------------------

            result = generate_forecast(
                daily_df,
                raw_material,
                unit,
                holiday_lookup
            )

            # ----------------------------------------------
            # Skip Raw Materials
            # ----------------------------------------------

            if len(result["history"]) < CONFIG["MIN_HISTORY"]:
                skipped += 1
                print("  -> Skipped (Insufficient History)")
                continue

            # ----------------------------------------------
            # Store Result
            # ----------------------------------------------

            forecast_key = f"{raw_material} | {unit}"
            forecast_database[forecast_key] = {
                "product": raw_material,
                "raw_material": raw_material,
                "unit": unit,
                "history": result["history"],
                "stationary": result["stationary"],
                "training": result["training"],
                "model": result["model"],
                "forecast": result["forecast"]
            }

            metrics = result["training"]["metrics"]
            print(
                f"  \u2713 "
                f"(MAPE {metrics['mape']:.2f}%)"
            )

        except Exception as e:
            skipped += 1
            print(f"  \u2717 {e}")
            continue

    # ----------------------------------------------------------
    # Summary
    # ----------------------------------------------------------

    print("\n")
    print("=" * 70)
    print("DATABASE COMPLETE")
    print("=" * 70)
    print(f"Stored Models : {len(forecast_database)}")
    print(f"Skipped       : {skipped}")
    print("=" * 70)

    return forecast_database

# =============================================================================
# EXPORT ALL FORECASTS
# =============================================================================

def export_forecast_database(forecast_database,
                             filename="forecast_database.csv"):
    """
    Export the 7-day forecast of every product to a CSV file.
    """

    rows = []

    for forecast_key, result in forecast_database.items():

        product = result["product"]
        raw_material = result["raw_material"]
        unit = result["unit"]

        training = result["training"]

        metrics = training["metrics"]

        future = result["forecast"]

        for _, row in future.iterrows():

            rows.append({

                "Product": product,

                "RawMaterial": raw_material,

                "Unit": unit,

                "Date": row["Date"],

                "Forecast": row["Forecast"],

                "RawMaterialUsage": row["Forecast"],

                "Lower95": row["Lower95"],

                "Upper95": row["Upper95"],

                "Order": str(training["order"]),

                "SeasonalOrder": str(training["seasonal"]),

                "AIC": round(metrics["aic"], 2),

                "BIC": round(metrics["bic"], 2),

                "MAE": round(metrics["mae"], 2),

                "RMSE": round(metrics["rmse"], 2),

                "MAPE": round(metrics["mape"], 2),

                "SMAPE": round(metrics["smape"], 2)

            })

    export_df = pd.DataFrame(rows)

    export_df.to_csv(

        filename,

        index=False

    )

    print("\n" + "=" * 70)

    print(f"Forecast exported to '{filename}'")

    print(f"Total rows : {len(export_df)}")

    print(f"Products   : {len(forecast_database)}")

    print("=" * 70)

# =============================================================================
# MODEL RANKING
# =============================================================================

def rank_models(forecast_database):
    """
    Rank models based on MAPE.
    """

    ranking = sorted(

        forecast_database.items(),
        key=lambda item:
        item[1]["training"]["metrics"]["mape"]

    )

    print("\n")
    print("=" * 70)
    print("TOP 10 FORECAST MODELS")
    print("=" * 70)

    for i, (product, result) in enumerate(
        ranking[:10],
        start=1

    ):

        metrics = result["training"]["metrics"]

        print(
            f"{i:2}. "
            f"{product:<35}"
            f"MAPE = {metrics['mape']:.2f}%  "
            f"SMAPE = {metrics['smape']:.2f}%"
        )
    print("=" * 70)
    return ranking

# =============================================================================
# MAIN PROGRAM
# =============================================================================

def run_once(interactive=True):
    raw = load_dataset()
    daily = aggregate_daily_sales(raw)

    print("=" * 80)
    print("SARIMA PRODUCT DEMAND FORECASTING SYSTEM")
    print("=" * 80)

    # ----------------------------------------------------------
    # Build Database
    # ----------------------------------------------------------

    holiday_lookup = build_holiday_lookup(raw)
    forecast_database = forecast_all_products(daily, holiday_lookup)
    
    export_forecast_database(forecast_database)

    if len(forecast_database) == 0:

        print("\nNo products were successfully trained.")

        return

    # ----------------------------------------------------------
    # Display Top Models
    # ----------------------------------------------------------

    rank_models(forecast_database)

    # ----------------------------------------------------------
    # Product Viewer
    # ----------------------------------------------------------

    if not interactive:
        return forecast_database

    while True:

        print("\n" + "=" * 80)

        print("PRODUCT FORECAST VIEWER")

        print("=" * 80)

        keyword = input(

            "\nEnter Product Name (or EXIT): "

        ).strip()

        if keyword.upper() == "EXIT":

            print("\nThank you for using the system.")

            break

        # ------------------------------------------------------
        # Partial Search
        # ------------------------------------------------------

        matches = [

            product

            for product in forecast_database
            if keyword.lower() in product.lower()

        ]

        if len(matches) == 0:

            print("\nNo matching product found.")
            continue

        if len(matches) > 1:
            print("\nMatching Products\n")

            for i, product in enumerate(matches, start=1):
                print(f"{i:2}. {product}")

            try:

                choice = int(
                    input("\nSelect Product Number: ")
                )

                product = matches[choice - 1]

            except:

                print("\nInvalid selection.")
                continue

        else:

            product = matches[0]
        result = forecast_database[product]
        training = result["training"]
        metrics = training["metrics"]
        confidence = max(
            0,
            100 - metrics["mape"]

        )

        # ------------------------------------------------------
        # Product Summary
        # ------------------------------------------------------

        print("\n")
        print("=" * 80)
        print(product)

        print("=" * 80)
        print(f"Order           : {training['order']}")
        print(f"Seasonal Order  : {training['seasonal']}")
        print(f"AIC             : {metrics['aic']:.2f}")
        print(f"BIC             : {metrics['bic']:.2f}")
        print(f"MAE             : {metrics['mae']:.2f}")
        print(f"RMSE            : {metrics['rmse']:.2f}")
        print(f"MAPE            : {metrics['mape']:.2f}%")
        print(f"SMAPE           : {metrics['smape']:.2f}%")
        print(f"Confidence      : {confidence:.2f}%")
        print("=" * 80)

        # ------------------------------------------------------
        # Validation Chart (train / actual / predicted, most recent
        # CV fold - opens in your browser)
        # ------------------------------------------------------

        plot_forecasts(
            training,
            product
        )

        # ------------------------------------------------------
        # Forecast Table
        # ------------------------------------------------------

        print_future_forecast(

            result["forecast"],

            product

        )

        # ------------------------------------------------------
        # Forecast Chart (next N days with 95% confidence band -
        # opens in your browser)
        # ------------------------------------------------------

        plot_future_forecast(
            result["forecast"],
            product
        )

        # ------------------------------------------------------
        # Save CSV
        # ------------------------------------------------------

        save_forecast_csv(

            result["forecast"],

            product

        )

    return forecast_database


def main():
    parser = argparse.ArgumentParser(
        description="Run SARIMA forecasting once or every seven days."
    )
    parser.add_argument(
        "--schedule",
        action="store_true",
        help="Run a forecast now, then repeat every seven days.",
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run once without opening the interactive product viewer.",
    )
    args = parser.parse_args()

    if args.schedule:
        interval_seconds = CONFIG["RERUN_DAYS"] * 24 * 60 * 60
        print(
            f"Scheduled mode enabled: SARIMA will rerun every "
            f"{CONFIG['RERUN_DAYS']} days. Press Ctrl+C to stop."
        )
        while True:
            run_once(interactive=False)
            next_run = pd.Timestamp.now() + pd.Timedelta(
                seconds=interval_seconds
            )
            print(f"Next SARIMA run: {next_run:%Y-%m-%d %H:%M:%S}")
            try:
                time.sleep(interval_seconds)
            except KeyboardInterrupt:
                print("\nScheduled SARIMA forecasting stopped.")
                return
    else:
        run_once(interactive=not args.once)


# =============================================================================
# PROGRAM ENTRY
# =============================================================================

if __name__ == "__main__":

    main()