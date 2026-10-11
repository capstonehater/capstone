"""Weekly SARIMAX selection with guarded daily and period-total usage errors.

All constraints and transformations are learned from each training fold only.
Zero observations remain in MAE/RMSE; MAPE uses positive observations, as before.
"""
import warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX
from threadpoolctl import threadpool_limits


def features(dates, holiday, kind, origin=None):
    dates = pd.DatetimeIndex(dates)
    result = pd.DataFrame({"is_holiday": np.asarray(holiday, dtype=float)})
    if kind in ("weekday", "weekday_payday", 'weekday_signals'):
        for day in range(1, 7):
            result[f"weekday_{day}"] = (dates.dayofweek == day).astype(float)
    if kind == 'weekday_payday':
        result['payday_15_30'] = np.isin(dates.day, [15, 30]).astype(float)
    if kind == 'weekday_signals':
        from forecast_signals import features as signal_features
        result = pd.concat([result, signal_features(dates, origin if origin is not None else dates.max())], axis=1)
    return result


def metrics(actual, predicted):
    actual, predicted = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    absolute = np.abs(actual - predicted)
    positive = actual > 0
    denominator = np.abs(actual) + np.abs(predicted)
    valid = denominator > 0
    total = float(actual.sum())
    return {
        "mae": float(absolute.mean()),
        "rmse": float(np.sqrt(np.mean(absolute ** 2))),
        "mape": float(np.mean(absolute[positive] / actual[positive]) * 100) if positive.any() else np.nan,
        "smape": float(np.mean(np.divide(2 * absolute, denominator, out=np.zeros_like(absolute), where=valid)) * 100),
        "wape": float(absolute.sum() / total * 100) if total > 0 else np.nan,
        "bias_pct": float((predicted.sum() - total) / total * 100) if total > 0 else np.nan,
    }


def fit(series, candidate, maxiter=100):
    window = candidate["window"]
    train = series.tail(window).reset_index(drop=True) if window else series.reset_index(drop=True)
    if len(train) < 60:
        raise ValueError("At least 60 training days required")
    scale = max(float(train.qty.mean()), 1.)
    target = np.log1p(train.qty.to_numpy()) if candidate["transform"] == "log1p" else train.qty.to_numpy() / scale
    exog = features(train.Date, train.is_holiday, candidate["features"], train.Date.max())
    # Unseen holiday/dummy columns cannot be estimated in this window.
    columns = [column for column in exog if exog[column].nunique() > 1]
    exog = exog[columns].to_numpy() if columns else None
    with warnings.catch_warnings(), threadpool_limits(limits=1):
        warnings.simplefilter("ignore")
        model = SARIMAX(target, exog=exog, order=candidate["order"],
            seasonal_order=candidate["seasonal"], trend=candidate["trend"],
            enforce_stationarity=True, enforce_invertibility=True).fit(disp=False, maxiter=maxiter)
    if not model.mle_retvals.get("converged", False):
        raise ValueError("Optimizer did not converge")
    if not np.isfinite(model.params).all():
        raise ValueError("Non-finite fitted parameters")
    model._cafe_candidate = {**{key: candidate[key] for key in
        ["window", "transform", "features", "order", "seasonal", "trend"]}, "scale": scale, "exog_cols": columns,
        "training_days": len(train), 'origin': str(train.Date.max().date()), "ceiling": min(1e14, max(1., float(train.qty.max())) * 100)}
    return model


def predict(model, dates, holiday, interval=False):
    candidate = model._cafe_candidate
    exog = features(dates, holiday, candidate["features"], candidate.get('origin'))
    columns = candidate["exog_cols"]
    exog = exog[columns].to_numpy() if columns else None
    with threadpool_limits(limits=1):
        result = model.get_forecast(len(dates), exog=exog)
    values = np.asarray(result.predicted_mean)
    if interval:
        confidence = np.asarray(result.conf_int(alpha=.05))
        values = np.column_stack([values, confidence[:, 0], confidence[:, 1]])
    with np.errstate(over="ignore", invalid="ignore"):
        values = np.expm1(values) if candidate["transform"] == "log1p" else values * candidate["scale"]
    if not np.isfinite(values).all() or (values >= candidate["ceiling"]).any():
        raise ValueError("Forecast exceeds finite training-based range constraints")
    # Usage cannot be negative. Identical lower bound is applied in validation.
    return np.maximum(values, 0)


def candidate_specs():
    candidates = []
    for window in [182, 365, None]:
        for transform in ["log1p", "raw"]:
            candidates.append({"window": window, "transform": transform, "features": "level",
                "order": (1, 0, 0), "seasonal": (1, 0, 0, 7), "trend": "c"})
    # A bounded grid retains simple integrated and stationary alternatives.
    for order in [(0, 0, 0), (1, 0, 0), (2, 0, 0), (0, 1, 0), (1, 0, 1), (2, 1, 1)]:
        candidates.append({"window": None, "transform": "log1p", "features": "level",
            "order": order, "seasonal": (1, 0, 0, 7), "trend": "n"})
    # Deterministic weekday demand competes with stochastic weekly seasonality;
    # it is retained only when rolling validation passes the same error guards.
    for window in [182, 365, None]:
        for transform in ["log1p", "raw"]:
            candidates.append({"window": window, "transform": transform, "features": "weekday",
                "order": (1, 0, 0), "seasonal": (0, 0, 0, 7), "trend": "c"})
    for transform in ['log1p', 'raw']:
        candidates.append({'window': None, 'transform': transform, 'features': 'weekday_payday',
            'order': (1, 0, 0), 'seasonal': (0, 0, 0, 7), 'trend': 'c'})
    from forecast_signals import source
    if source().exists():
        candidates.append({'window': None, 'transform': 'raw', 'features': 'weekday_signals',
            'order': (1, 0, 0), 'seasonal': (0, 0, 0, 7), 'trend': 'c'})
    return candidates


def rank_candidates(candidates, mae_tolerance=.10, volume_estimation=False, error_tolerance=.10):
    if not candidates:
        raise ValueError("No candidates to rank")
    if not np.isfinite(mae_tolerance) or not 0 <= mae_tolerance <= 1:
        raise ValueError("MAE tolerance must be between zero and one")
    if any(not np.isfinite(candidate["metrics"]["mae"]) or candidate["metrics"]["mae"] < 0 for candidate in candidates):
        raise ValueError("Finite nonnegative validation MAE is required")
    best_mae = min(candidate["metrics"]["mae"] for candidate in candidates)
    limit = best_mae * (1 + mae_tolerance) + 1e-9
    eligible = [candidate for candidate in candidates if candidate["metrics"]["mae"] <= limit]
    # Undefined MAPE on all-zero validation must fall back to absolute error.
    has_mape = any(np.isfinite(candidate.get("selection_mape", candidate["metrics"]["mape"])) for candidate in eligible)
    def score(candidate):
        mape = candidate.get("selection_mape", candidate["metrics"]["mape"])
        return (mape if np.isfinite(mape) else np.inf, candidate["metrics"]["mae"])
    ranked = sorted(eligible, key=score if has_mape else lambda candidate: candidate["metrics"]["mae"])
    if volume_estimation and has_mape:
        if not np.isfinite(error_tolerance) or not 0 <= error_tolerance <= 1:
            raise ValueError("Operational error tolerance must be between zero and one")
        reference = ranked[0]
        mape_limit = reference.get("selection_mape", reference["metrics"]["mape"]) * (1 + error_tolerance) + 1e-9
        rmse_limit = reference["metrics"]["rmse"] * (1 + error_tolerance) + 1e-9
        safe = [candidate for candidate in ranked
                if candidate.get("selection_mape", candidate["metrics"]["mape"]) <= mape_limit
                and candidate["metrics"]["rmse"] <= rmse_limit]
        if safe and any(np.isfinite(candidate["metrics"].get("period_volume_error", np.nan)) for candidate in safe):
            ranked = sorted(safe, key=lambda candidate: (
                candidate["metrics"].get("period_volume_error", np.inf),
                candidate["metrics"]["rmse"], score(candidate)))
            return ranked, best_mae, limit, "period_volume_error_with_mae_mape_rmse_guards"
    return ranked, best_mae, limit, "mape_with_mae_guard" if has_mape else "mae"


def aggregate_candidate(spec, folds, cached):
    if not folds or any(fold is None for fold in folds):
        return None
    averages = {}
    for key in ["mae", "rmse", "mape", "smape", "aic", "bic"]:
        numbers = [fold[key] for fold in folds if np.isfinite(fold[key])]
        averages[key] = float(np.mean(numbers)) if numbers else np.nan
    selection_mape = averages["mape"]
    if any(not np.isfinite(fold["mape"]) for fold in folds):
        averages["mape"] = np.nan
    pooled = metrics(np.concatenate([fold["test"].qty.to_numpy() for fold in folds]),
                     np.concatenate([fold["predictions"] for fold in folds]))
    averages.update({key: pooled[key] for key in ["wape", "bias_pct"]})
    actual_total = sum(float(fold["test"].qty.sum()) for fold in folds)
    averages["period_volume_error"] = (sum(abs(float(fold["predictions"].sum()) - float(fold["test"].qty.sum()))
        for fold in folds) / actual_total * 100 if actual_total > 0 else np.nan)
    return {**spec, "metrics": averages, "selection_mape": selection_mape,
        "fold_metrics": folds, "interval_cached_folds": [fold for fold in cached if fold is not None],
        "exog_cols": ["is_holiday"] + ([f"weekday_{day}" for day in range(1, 7)] if spec["features"] == "weekday" else []),
        "constrained": True}


def train(stationary, config):
    series = stationary["series"].reset_index(drop=True)
    horizon = config.get("CV_HORIZON") or config["FORECAST_DAYS"]
    interval_plan = None
    calibration_folds = config.get("INTERVAL_CALIBRATION_FOLDS", 6)
    evaluation_folds = config.get("INTERVAL_VALIDATION_FOLDS", 1)
    reserve = horizon * evaluation_folds
    if len(series) - reserve >= 60 + horizon * max(config["CV_FOLDS"], calibration_folds):
        interval_plan = {"horizon": horizon, "selectionEnd": len(series) - reserve,
            "calibrationFolds": calibration_folds, "evaluationFolds": evaluation_folds,
            "positiveDemandGuard": config.get("INTERVAL_POSITIVE_DEMAND_GUARD", False)}
    # Earlier and current selections share most rolling folds. Cache both mean
    # and interval forecasts so honest outer testing does not duplicate fits.
    count = config["CV_FOLDS"] + (evaluation_folds if interval_plan else 0)
    folds = [(len(series) - horizon * (fold + 1), len(series) - horizon * fold)
             for fold in reversed(range(count))]
    folds = [(start, end) for start, end in folds if start >= 60]
    if not folds:
        raise ValueError("Insufficient history for constrained rolling validation")
    specs = candidate_specs()
    candidates, earlier_candidates, all_backcasts = [], [], []
    for spec in specs:
        cached = []
        for index, (start, end) in enumerate(folds):
            # Only the earlier/current selection folds need a whole-grid fit.
            # Intermediate interval tests refit just the selected configuration.
            middle = interval_plan and config["CV_FOLDS"] <= index < len(folds) - config["CV_FOLDS"]
            benchmark_reference = config.get("BENCHMARK_BACKCASTS") and spec["features"] == "level" and index >= len(folds) - 4
            if middle and not benchmark_reference:
                cached.append(None)
                continue
            training, test = series.iloc[:start], series.iloc[start:end]
            try:
                model = fit(training, spec)
                values = predict(model, test.Date, test.is_holiday, interval=True)
                errors = metrics(test.qty, values[:, 0])
                if not all(np.isfinite(errors[key]) for key in ["mae", "rmse", "smape"]):
                    raise ValueError("Non-finite validation errors")
                cached.append({**errors, "aic": float(model.aic), "bic": float(model.bic),
                    "train": training.tail(spec["window"]) if spec["window"] else training,
                    "test": test.copy(), "predictions": values[:, 0], "intervals": values})
            except (ValueError, np.linalg.LinAlgError):
                cached.append(None)
        all_backcasts.append({"spec": spec, "folds": cached})
        current = aggregate_candidate(spec, cached[-config["CV_FOLDS"]:], cached)
        if current:
            candidates.append(current)
        if interval_plan:
            earlier = aggregate_candidate(spec, cached[:config["CV_FOLDS"]], cached)
            if earlier:
                earlier_candidates.append(earlier)
    if not candidates:
        raise ValueError("No converged SARIMA candidate passed validation constraints")
    tolerance = config.get("MAE_TOLERANCE", .10)
    operational = config.get("VOLUME_ESTIMATION", False)
    error_tolerance = config.get("OPERATIONAL_ERROR_TOLERANCE", .10)
    reference = rank_candidates(candidates, tolerance)[0][0]
    ranked, best_mae, limit, criterion = rank_candidates(candidates, tolerance, operational, error_tolerance)
    earlier_best = None
    if earlier_candidates:
        earlier_best = rank_candidates(earlier_candidates, tolerance, operational, error_tolerance)[0][0]
    for candidate in ranked:
        candidate["interval_plan"] = interval_plan if earlier_best else None
        candidate["interval_validation_candidate"] = earlier_best
    best = ranked[0]
    last = best["fold_metrics"][-1]
    validation_model = fit(last["train"], best)
    return {**best, "model": validation_model, "train": last["train"], "test": last["test"],
        "predictions": last["predictions"], "used_cv": True, "candidates": ranked,
        **({"all_validated_candidates": candidates, "all_evaluated_backcasts": all_backcasts}
           if config.get("BENCHMARK_BACKCASTS") else {}),
        "candidate_count": len(specs), "successful_candidates": len(candidates),
        "selection_metric": criterion, "mae_guard_limit": limit, "best_validation_mae": best_mae,
        "operational_guards": {"enabled": operational, "tolerance": error_tolerance,
            "referenceMAPE": float(reference["selection_mape"]) if np.isfinite(reference["selection_mape"]) else None,
            "referenceRMSE": float(reference["metrics"]["rmse"]),
            "mapeLimit": float(reference["selection_mape"] * (1 + error_tolerance) + 1e-9) if np.isfinite(reference["selection_mape"]) else None,
            "rmseLimit": float(reference["metrics"]["rmse"] * (1 + error_tolerance) + 1e-9)},
        "rejected_by_mae_guard": len(candidates) - len(ranked)}


def forecast(model, stationary, horizon, holiday_function):
    dates = pd.date_range(pd.Timestamp(stationary["series"].Date.max()) + pd.Timedelta(days=1), periods=horizon)
    values = predict(model, dates, holiday_function(dates).to_numpy(), interval=True)
    from interval_calibration import apply
    values = apply(values, getattr(model, "_cafe_interval", {}))
    if not np.isfinite(values).all() or (values >= model._cafe_candidate["ceiling"]).any():
        raise ValueError("Calibrated forecast exceeds finite training-based range constraints")
    return pd.DataFrame({"Date": dates, "Forecast": values[:, 0], "Lower95": values[:, 1], "Upper95": values[:, 2]})
