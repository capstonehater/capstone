"""Empirical daily prediction intervals with chronological calibration/testing.

The finite-sample quantile is conformal-inspired. Calibration backcasts use the
selected configuration and overlap model-selection dates; only the later test
period is independent of selection. Dependent errors are not exchangeable, so
95% is a target, never a coverage guarantee. These are pointwise daily intervals,
not simultaneous weekly inventory bounds.
"""
import math
import numpy as np


def quantile(scores, coverage=.95):
    scores = np.asarray(scores, dtype=float)
    if not len(scores) or not np.isfinite(scores).all():
        raise ValueError("Finite calibration residuals are required")
    rank = math.ceil((len(scores) + 1) * coverage)
    if rank > len(scores):
        raise ValueError("Too few observations for the requested calibration quantile")
    return float(np.partition(scores, rank - 1)[rank - 1])


def summarize(actual, values, coverage=.95, baseline=None):
    actual, values = np.asarray(actual), np.asarray(values)
    lower, upper = values[:, 1], values[:, 2]
    covered = (actual >= lower) & (actual <= upper)
    positive = actual > 0
    width = upper - lower
    score = width + 2 / (1 - coverage) * (np.maximum(lower - actual, 0) + np.maximum(actual - upper, 0))
    errors = np.abs(actual - values[:, 0])
    total = float(actual.sum())
    baseline_error = float(np.abs(actual - baseline).sum()) if baseline is not None else None
    return {"coverage": float(covered.mean()), "coveredDays": int(covered.sum()),
        "days": len(actual), "positiveDemandCoverage": float(covered[positive].mean()) if positive.any() else None,
        "positiveDemandDays": int(positive.sum()), "positiveDemandCoveredDays": int(covered[positive].sum()),
        "meanWidth": float(width.mean()),
        "intervalScore": float(score.mean()),
        "actualTotal": total, "forecastTotal": float(values[:, 0].sum()),
        "absoluteErrorTotal": float(errors.sum()), "baselineAbsoluteErrorTotal": baseline_error,
        "wape": float(errors.sum() / total * 100) if total > 0 else None,
        "biasPercent": float((values[:, 0].sum() - total) / total * 100) if total > 0 else None,
        "seasonalNaiveMAE": baseline_error / len(actual) if baseline_error is not None else None,
        "seasonalNaiveSkill": float(1 - errors.sum() / baseline_error) if baseline_error else None}


def apply(values, calibration):
    result = np.array(values, copy=True)
    if calibration.get("method") != "rolling_residual_calibration":
        return result
    if len(values) > calibration["maxHorizon"]:
        raise ValueError("Prediction distance exceeds the calibrated horizon")
    # Scale follows the model's horizon-specific uncertainty, with a training-only
    # floor so tiny fitted Gaussian variance does not divide residuals by zero.
    scale = np.maximum((values[:, 2] - values[:, 1]) / 2, calibration["scaleFloor"])
    factors = np.array([calibration["factors"][(step // 7)] for step in range(len(values))])
    # A vanishing fitted variance can otherwise put the lower bound a tiny
    # positive distance above zero (e.g. 1e-45), falsely missing zero usage.
    # This tolerance is far below the recorded quantities' precision.
    radius = np.maximum(scale * factors, 1e-8)
    result[:, 1] = np.maximum(0, values[:, 0] - radius)
    if calibration.get("zeroDemandFrequency", 0) >= 1 - calibration.get("targetCoverage", .95):
        # Retain the observed zero-demand support for intermittent materials.
        result[:, 1] = 0
    result[:, 2] = values[:, 0] + radius
    if calibration.get("positiveUpperFactors"):
        upper_factors = np.array([calibration["positiveUpperFactors"][step // 7] for step in range(len(values))])
        result[:, 2] = np.maximum(result[:, 2], values[:, 0] + scale * upper_factors)
    return result


def calibrate(series, candidate, plan):
    from constrained_sarima import fit, predict
    horizon = plan["horizon"]
    split = plan["selectionEnd"] - horizon * plan["calibrationFolds"]
    calibration_end = split + horizon * plan["calibrationFolds"]
    records = []
    failures = []
    cached = {str(fold["test"].Date.min().date()): fold
              for fold in candidate.get("interval_cached_folds", [])}

    def backcast(start):
        test = series.iloc[start:start + horizon]
        if candidate.get('model_type') == 'seasonal_naive':
            centers = np.resize(series.iloc[:start].qty.tail(7).to_numpy(), len(test))
            return test, np.column_stack([centers, centers, centers])
        previous = cached.get(str(test.Date.min().date()))
        if previous is not None and previous["test"].Date.tolist() == test.Date.tolist():
            return test, previous["intervals"]
        model = fit(series.iloc[:start], candidate)
        return test, predict(model, test.Date, test.is_holiday, interval=True)

    for start in range(split, calibration_end, horizon):
        test = series.iloc[start:start + horizon]
        try:
            test, values = backcast(start)
            records.append((test, values))
        except (ValueError, np.linalg.LinAlgError) as exc:
            failures.append(str(exc))
    base = {"targetCoverage": .95, "pointwise": True, "maxHorizon": horizon,
        "selectionEnd": str(series.iloc[plan["selectionEnd"] - 1].Date.date()),
        "calibrationMethod": "retrospective_fixed_configuration",
        "validationIndependentOfSelection": True,
        "calibrationStart": str(series.iloc[split].Date.date()),
        "calibrationEnd": str(series.iloc[calibration_end - 1].Date.date()),
        "failedCalibrationFolds": len(failures),
        "coverageGuarantee": False}
    # Every later validation interval is issued before its observations enter
    # the rolling residual window. Production uses the latest completed errors.
    count = sum(len(test) for test, _ in records)
    if len(records) < 3 or count < 19:
        return {**base, "method": "model_based", "calibrationDays": count,
            "reason": "Insufficient successful chronological calibration folds", "validation": None}

    def parameters(buffer):
        widths = np.concatenate([(values[:, 2] - values[:, 1]) / 2 for _, values in buffer])
        floor = max(float(np.median(widths)), float(series.iloc[:split].qty.mean()) * .01, 1e-8)
        errors = np.concatenate([np.abs(test.qty.to_numpy() - values[:, 0]) for test, values in buffer])
        scores = errors / np.maximum(widths, floor)
        steps = np.concatenate([np.arange(len(test)) for test, _ in buffer])
        factors, bucket_counts = [], []
        positive = np.concatenate([test.qty.to_numpy() > 0 for test, _ in buffer])
        underestimates = np.concatenate([np.maximum(test.qty.to_numpy() - values[:, 0], 0)
                                        for test, values in buffer]) / np.maximum(widths, floor)
        positive_factors, positive_counts, positive_methods = [], [], []
        for offset in range(0, horizon, 7):
            bucket = scores[(steps >= offset) & (steps < offset + 7)]
            # Pool partial weeks explicitly when fewer than 19 errors exist.
            samples = bucket if len(bucket) >= 19 else scores
            factors.append(quantile(samples))
            bucket_counts.append(len(samples))
            if plan.get("positiveDemandGuard"):
                positive_scores = underestimates[positive & (steps >= offset) & (steps < offset + 7)]
                pooled = len(positive_scores) < 19
                if pooled:
                    positive_scores = underestimates[positive]
                if len(positive_scores) >= 19:
                    positive_factors.append(quantile(positive_scores))
                    positive_methods.append("pooled_positive_quantile" if pooled else "horizon_positive_quantile")
                else:
                    positive_factors.append(float(positive_scores.max()) if len(positive_scores) else 0.)
                    positive_methods.append("observed_positive_maximum" if len(positive_scores) else "no_positive_observations")
                positive_counts.append(len(positive_scores))
        return {**base, "method": "rolling_residual_calibration",
            "calibrationDays": len(scores), "calibrationFolds": len(buffer),
            "calibrationStart": str(buffer[0][0].Date.min().date()),
            "calibrationEnd": str(buffer[-1][0].Date.max().date()),
            "scaleFloor": floor, "factors": factors, "bucketSampleCounts": bucket_counts,
            "positiveDemandGuard": bool(plan.get("positiveDemandGuard")),
            "zeroDemandFrequency": float(1 - positive.mean()),
            "positiveUpperFactors": positive_factors,
            "positiveSampleCounts": positive_counts, "positiveQuantileMethods": positive_methods,
            "horizonBucketDays": 7}

    actual, calibrated, original = [], [], []
    evaluated_dates, fold_coverage, evaluation_steps, fold_details, baselines = [], [], [], [], []
    for start in range(calibration_end, len(series) - horizon + 1, horizon):
        test = series.iloc[start:start + horizon]
        try:
            test, values = backcast(start)
            prior = parameters(records[-plan["calibrationFolds"]:])
            adjusted = apply(values, prior)
            actual.extend(test.qty.to_numpy())
            original.extend(values)
            calibrated.extend(adjusted)
            evaluated_dates.extend(test.Date)
            # A competing forecast known at the origin, repeated for each week.
            baseline = np.resize(series.iloc[start - 7:start].qty.to_numpy(), len(test))
            baselines.extend(baseline)
            evaluation_steps.extend(range(1, len(test) + 1))
            fold_coverage.append(summarize(test.qty, adjusted, baseline=baseline)["coverage"])
            fold_details.append({"start": str(test.Date.min().date()), "end": str(test.Date.max().date()),
                "calibrationEnd": prior["calibrationEnd"], "factors": prior["factors"],
                "positiveUpperFactors": prior["positiveUpperFactors"],
                "positiveSampleCounts": prior["positiveSampleCounts"],
                "byHorizon": [{"day": step + 1, "date": str(test.iloc[step].Date.date()),
                    "days": 1,
                    "coveredDays": int(adjusted[step, 1] <= test.iloc[step].qty <= adjusted[step, 2]),
                    "positiveDemandDays": int(test.iloc[step].qty > 0),
                    "positiveDemandCoveredDays": int(test.iloc[step].qty > 0 and
                        adjusted[step, 1] <= test.iloc[step].qty <= adjusted[step, 2])}
                    for step in range(len(test))]})
            # Only AFTER issuing and scoring this period can its errors be used.
            records.append((test, values))
        except (ValueError, np.linalg.LinAlgError):
            continue
    result = parameters(records[-plan["calibrationFolds"]:])
    if not actual:
        result["validation"] = None
        return result
    result["validation"] = {**summarize(actual, calibrated, baseline=np.asarray(baselines)),
        "start": str(min(evaluated_dates).date()), "end": str(max(evaluated_dates).date()),
        "folds": len(fold_coverage), "foldCoverage": fold_coverage,
        "method": "prequential_rolling_origins", "windows": fold_details,
        "modelBased": summarize(actual, original),
        "pointMetrics": __import__("constrained_sarima").metrics(actual, np.asarray(calibrated)[:, 0])}
    result["validation"]["byHorizon"] = [
        {"day": step,
         "start": str(min(date for date, day in zip(evaluated_dates, evaluation_steps) if day == step).date()),
         "end": str(max(date for date, day in zip(evaluated_dates, evaluation_steps) if day == step).date()),
         **summarize(np.asarray(actual)[np.asarray(evaluation_steps) == step],
            np.asarray(calibrated)[np.asarray(evaluation_steps) == step],
            baseline=np.asarray(baselines)[np.asarray(evaluation_steps) == step])}
        for step in range(1, horizon + 1)]
    for key, value in result["validation"]["pointMetrics"].items():
        if not np.isfinite(value):
            result["validation"]["pointMetrics"][key] = None
    return result


def requested_validation(interval, first, last):
    """Coverage for the actual requested week, including any history gap."""
    validation = interval.get("validation")
    if not validation:
        return None
    selected = [row for row in validation["byHorizon"] if first <= row["day"] <= last]
    days = sum(row["days"] for row in selected)
    if not days:
        return None
    covered = sum(row["coveredDays"] for row in selected)
    positive = sum(row["positiveDemandDays"] for row in selected)
    positive_covered = sum(row["positiveDemandCoveredDays"] for row in selected)
    result = {"coverage": covered / days, "coveredDays": covered, "days": days,
        "positiveDemandDays": positive,
        "positiveDemandCoverage": positive_covered / positive if positive else None,
        "meanWidth": sum(row["meanWidth"] * row["days"] for row in selected) / days,
        "start": min(row["start"] for row in selected), "end": max(row["end"] for row in selected),
        "folds": validation["folds"],
        "horizonStart": first, "horizonEnd": last}
    if all("actualTotal" in row for row in selected):
        total = sum(row["actualTotal"] for row in selected)
        prediction = sum(row["forecastTotal"] for row in selected)
        errors = sum(row["absoluteErrorTotal"] for row in selected)
        baseline = sum(row["baselineAbsoluteErrorTotal"] for row in selected)
        result.update({"actualTotal": total, "forecastTotal": prediction,
            "wape": errors / total * 100 if total > 0 else None,
            "biasPercent": (prediction - total) / total * 100 if total > 0 else None,
            "seasonalNaiveMAE": baseline / days,
            "seasonalNaiveSkill": 1 - errors / baseline if baseline > 0 else None})
    periods = []
    for window in validation.get("windows", []):
        rows = [row for row in window.get("byHorizon", []) if first <= row["day"] <= last]
        if rows:
            period_days = sum(row["days"] for row in rows)
            period_positive = sum(row["positiveDemandDays"] for row in rows)
            periods.append({"start": min(row["date"] for row in rows), "end": max(row["date"] for row in rows),
                "coverage": sum(row["coveredDays"] for row in rows) / period_days,
                "days": period_days, "positiveDemandDays": period_positive,
                "positiveDemandCoverage": sum(row["positiveDemandCoveredDays"] for row in rows) / period_positive if period_positive else None})
    if periods:
        result["periods"] = periods
        result["minimumPeriodCoverage"] = min(period["coverage"] for period in periods)
        result["periodsAtTarget"] = sum(period["coverage"] >= interval.get("targetCoverage", .95) for period in periods)
    return result


def build_intervals(series, training):
    """Test the earlier selection, then calibrate the current production model."""
    plan = training["interval_plan"]
    earlier = training.get("interval_validation_candidate") or training
    tested = calibrate(series, earlier, plan)
    keys = ["order", "seasonal", "window", "transform", "features", "trend"]
    same = all(earlier.get(key) == training.get(key) for key in keys)
    if same:
        result = tested
    else:
        production_plan = {**plan, "selectionEnd": len(series), "evaluationFolds": 0}
        result = calibrate(series, training, production_plan)
        if result["method"] == tested["method"]:
            result["validation"] = tested["validation"]
    result["validationConfiguration"] = {key: earlier.get(key) for key in keys}
    result["validationConfiguration"]["selectionEnd"] = str(series.iloc[plan["selectionEnd"] - 1].Date.date())
    result["productionConfigurationUpdated"] = not same
    result["validationScope"] = "forecasting_procedure_before_latest_observations"
    return result
