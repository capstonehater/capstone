"""Operational interpretation of measured forecast errors; no accuracy probability."""
import numpy as np


def build_insights(series, training, future, current_stock, requirements=None):
    requirements = requirements or {"minimumTestDays": 30, "minimumPositiveDays": 20,
                                    "maximumWAPE": 30., "maximumHistoryGapDays": 7, "minimumPeriodCoverage": .80}
    interval = training.get("interval_calibration") or {}
    validation = interval.get("requestedValidation") or interval.get("validation")
    recent = series.tail(90)
    positive_days = int((recent.qty > 0).sum())
    total = float(future.Forecast.sum())
    stress = float(future.Upper95.sum())
    gap = max(0, (future.index.min() - series.Date.max()).days - 1)
    reasons = []
    limited = not validation or validation["days"] < requirements["minimumTestDays"]
    if limited:
        reasons.append("More held-out forecast days are needed to assess reliability.")
    if not validation or validation["positiveDemandDays"] < requirements["minimumPositiveDays"]:
        limited = True
        reasons.append("There are too few held-out days with usage to assess demand-spike coverage.")
    target = interval.get("targetCoverage", .95)
    if validation:
        if validation["coverage"] < target:
            reasons.append("Measured daily interval coverage is below the requested target.")
        if validation["positiveDemandCoverage"] is not None and validation["positiveDemandCoverage"] < target:
            reasons.append("Measured interval coverage on days with usage is below the requested target.")
        if validation.get("minimumPeriodCoverage", 1) < requirements.get("minimumPeriodCoverage", .80):
            reasons.append("Interval coverage was inconsistent across earlier forecast periods.")
        if validation.get("wape") is not None and validation["wape"] > requirements["maximumWAPE"]:
            reasons.append("Volume-weighted daily error exceeds the configured planning threshold.")
        if validation.get("seasonalNaiveSkill") is None:
            reasons.append("Improvement over repeating last week's usage could not be established.")
        elif validation["seasonalNaiveSkill"] <= 0:
            reasons.append("The earlier SARIMA test did not beat repeating last week's usage.")
    if gap > requirements["maximumHistoryGapDays"]:
        reasons.append("Recent usage is missing beyond the configured history-gap threshold.")
    if positive_days == 0:
        reasons.append("No recent usage was observed; zero forecasts do not establish accuracy for future orders.")
    elif positive_days < len(recent) / 2:
        reasons.append("Usage is intermittent; plan for occasional spikes as well as the central estimate.")
    status = "limited" if limited else "caution" if reasons else "supported"
    return {"evidenceStatus": status, "requirements": requirements, "reasons": reasons,
        "recentDays": len(recent), "recentPositiveDays": positive_days,
        "recentUsageFrequency": positive_days / len(recent), "historyGapDays": gap,
        "estimatedTotalUsage": total,
        "estimatedShortfall": max(0., total - current_stock) if current_stock is not None else None,
        "dailyUpperStressTotal": stress,
        "stressShortfall": max(0., stress - current_stock) if current_stock is not None else None,
        "stressScenarioInterpretation": "Sum of daily upper bounds: a stock stress scenario, not a 95% interval for total usage.",
        "validation": validation,
        "scope": "Earlier held-out forecasting procedure; evidence is not a future accuracy probability."}
