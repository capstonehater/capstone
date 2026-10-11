"""Chronological demand routing, baseline competition and block residual quantiles.

Configuration discovery, method selection, calibration and outer testing use
disjoint date ranges. Targets are not coverage guarantees for dependent sales.
"""
import math
import warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing
from constrained_sarima import fit, predict, metrics

BASELINES = ['seasonal_naive', 'weekday_average_4w', 'moving_average_28d', 'ets']


def classify(values):
    y = np.asarray(values, dtype=float)
    positive = y[y > 0]
    if not len(positive):
        return {'class': 'constant_zero', 'adi': None, 'cvSquared': None}
    if np.ptp(y) == 0:
        return {'class': 'constant', 'adi': 1., 'cvSquared': 0.}
    adi = len(y) / len(positive)
    cv = float(np.var(positive) / np.mean(positive) ** 2)
    label = ('lumpy' if cv >= .49 else 'intermittent') if adi >= 1.32 else ('erratic' if cv >= .49 else 'smooth')
    return {'class': label, 'adi': adi, 'cvSquared': cv,
            'thresholds': {'adi': 1.32, 'cvSquared': .49}}


def intermittent(values, method, alpha=.1, beta=.1):
    y = np.asarray(values, dtype=float)
    nonzero = np.flatnonzero(y > 0)
    if not len(nonzero):
        return 0.
    first = nonzero[0]
    size, interval, probability = float(y[first]), float(first + 1), 1. / (first + 1)
    gap = 1
    for value in y[first + 1:]:
        probability += beta * ((value > 0) - probability)
        if value > 0:
            size += alpha * (value - size)
            interval += alpha * (gap - interval)
            gap = 1
        else:
            gap += 1
    return size * probability if method == 'tsb' else (1 - alpha / 2) * size / interval


def point_forecast(series, method, horizon, sarima_spec=None):
    y = series.qty.to_numpy(dtype=float)
    if not len(y) or not np.isfinite(y).all() or (y < 0).any():
        raise ValueError('Finite nonnegative observed demand is required')
    dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=horizon)
    if method == 'seasonal_naive':
        values = np.resize(y[-7:], horizon)
    elif method == 'weekday_average_4w':
        recent = series.tail(28)
        means = recent.groupby(recent.Date.dt.dayofweek).qty.mean()
        values = np.array([means.get(day, float(recent.qty.mean())) for day in dates.dayofweek])
    elif method == 'moving_average_28d':
        values = np.repeat(np.mean(y[-28:]), horizon)
    elif method in ('sba', 'tsb'):
        values = np.repeat(intermittent(y, method), horizon)
    elif method == 'ets':
        if len(y) < 14 or np.ptp(y) == 0:
            values = np.repeat(np.mean(y), horizon)
        else:
            with warnings.catch_warnings():
                warnings.simplefilter('ignore')
                model = ExponentialSmoothing(y[-365:], seasonal='add', seasonal_periods=7,
                    initialization_method='estimated').fit(optimized=True)
            if not model.mle_retvals.get('success', True):
                raise ValueError('ETS did not converge')
            values = np.asarray(model.forecast(horizon))
    elif method == 'sarima':
        if sarima_spec is None:
            raise ValueError('SARIMA configuration unavailable')
        import SARIMA
        model = fit(series, sarima_spec)
        values = predict(model, dates, SARIMA.future_holiday_flags(dates).to_numpy())
    elif method == 'ensemble':
        values = np.mean([point_forecast(series, m, horizon, sarima_spec)
            for m in ('sarima', 'ets', 'weekday_average_4w')], axis=0)
    else:
        raise ValueError('Unknown forecasting method: ' + method)
    values = np.maximum(np.asarray(values, dtype=float), 0)
    ceiling = min(1e14, max(1., float(y.max())) * 100)
    if not np.isfinite(values).all() or (values >= ceiling).any():
        raise ValueError('Forecast failed finite training-based range guard')
    return values


def scaled_metrics(actual, predicted, training):
    y, p, history = np.asarray(actual), np.asarray(predicted), np.asarray(training)
    result = metrics(y, p)
    differences = history[7:] - history[:-7]
    mae_scale = float(np.mean(np.abs(differences))) if len(differences) else 0
    mse_scale = float(np.mean(differences ** 2)) if len(differences) else 0
    result.update(bias=float(np.mean(p - y)),
        mase=result['mae'] / mae_scale if mae_scale > 0 else None,
        rmsse=float(np.sqrt(np.mean((p - y) ** 2) / mse_scale)) if mse_scale > 0 else None,
        period_absolute_error=float(abs(p.sum() - y.sum())))
    return {k: float(v) if v is not None and np.isfinite(v) else None for k, v in result.items()}


def distribution(values):
    values = [v for v in values if v is not None and np.isfinite(v)]
    if not values:
        return None
    return dict(zip(('p10', 'median', 'p90', 'maximum'), map(float, np.quantile(values, [.1, .5, .9, 1]))))


def finite_quantile(values, probability):
    values = np.asarray(values, dtype=float)
    if not len(values) or not np.isfinite(values).all() or not 0 < probability < 1:
        raise ValueError('Finite residual samples and a probability between zero and one are required')
    rank = math.ceil((len(values) + 1) * probability)
    return float(np.sort(values)[min(rank, len(values)) - 1]), rank <= len(values)


def forecast_paths(center, residuals):
    # Whole historical error blocks preserve within-period error dependence.
    return np.maximum(0, np.asarray(center)[None, :] + np.asarray(residuals))


def path_summary(paths):
    total = np.asarray(paths).sum(axis=1)
    result = {'samples': len(paths), 'coverageGuarantee': False, 'quantiles': {}}
    for q in (.5, .8, .95, .97, .99):
        value, supported = finite_quantile(total, q)
        result['quantiles'][f'p{int(q * 100)}'] = value
        result.setdefault('finiteSampleSupported', {})[f'p{int(q * 100)}'] = supported
    return result


def probabilistic_scores(actual, center, residuals):
    y = np.asarray(actual)
    errors = np.asarray(residuals)
    radius, supported = finite_quantile(np.abs(errors).ravel(), .95)
    lower, upper = np.maximum(0, center - radius), center + radius
    covered = (lower <= y) & (y <= upper)
    positive = y > 0
    paths = forecast_paths(center, errors)
    pinball = {}
    for q in (.5, .8, .95):
        quant = np.quantile(paths, q, axis=0)
        delta = y - quant
        pinball[f'p{int(q * 100)}'] = float(np.mean(np.maximum(q * delta, (q - 1) * delta)))
    return {'coverage': float(covered.mean()), 'coveredDays': int(covered.sum()), 'days': len(y),
        'positiveDemandDays': int(positive.sum()), 'positiveDemandCoveredDays': int(covered[positive].sum()),
        'positiveCoverage': float(covered[positive].mean()) if positive.any() else None,
        'zeroCoverage': float(covered[~positive].mean()) if (~positive).any() else None,
        'meanWidth': float(np.mean(upper - lower)), 'pinballLoss': pinball,
        'intervalScore': float(np.mean(upper - lower + 40 * (np.maximum(lower - y, 0) + np.maximum(y - upper, 0)))),
        'finiteSampleSupported': supported}


def run(series, horizon, dates, cached=None, conservative=False):
    import SARIMA
    n = len(series)
    # 8 method-selection weeks, up to 20 calibration blocks, 5 outer test blocks.
    calibration_count = min(20, (n - 81) // horizon - 13)
    if calibration_count < 3:
        raise ValueError('Not enough history for independent portfolio selection/calibration/testing')
    discovery_end = n - (13 + calibration_count) * horizon
    selection_end = discovery_end + 8 * horizon
    calibration_end = selection_end + calibration_count * horizon
    discovery = series.iloc[:discovery_end]
    pattern = classify(discovery.qty)
    methods = BASELINES[:3] if conservative else BASELINES.copy()
    if pattern['class'] in ('intermittent', 'lumpy'):
        methods += ['sba', 'tsb']
    sarima_spec = None
    prior = (cached or {}).get('_portfolio_sarima_spec')
    prior_date = (cached or {}).get('_portfolio_discovery_end')
    try:
        if not conservative and discovery.qty.nunique() > 1:
            if prior and prior_date and 0 <= (discovery.Date.max() - pd.Timestamp(prior_date)).days < 28:
                sarima_spec = prior
            else:
                old_horizon = SARIMA.CONFIG.get('CV_HORIZON')
                SARIMA.CONFIG['CV_HORIZON'] = horizon
                try:
                    selected = SARIMA.train_sarima({'series': discovery})
                finally:
                    SARIMA.CONFIG['CV_HORIZON'] = old_horizon
                sarima_spec = {k: selected[k] for k in ('window', 'transform', 'features', 'order', 'seasonal', 'trend')}
                prior_date = str(discovery.Date.max().date())
            methods += ['sarima', 'ensemble']
    except (ValueError, np.linalg.LinAlgError):
        pass
    folds = {method: [] for method in methods}
    for start in range(discovery_end, selection_end, horizon):
        training, test = series.iloc[:start], series.iloc[start:start + horizon]
        mask = test.get('is_observed', pd.Series(True, index=test.index)).to_numpy(dtype=bool)
        for method in methods:
            try:
                values = point_forecast(training, method, horizon, sarima_spec)
                if not mask.any():
                    raise ValueError('No observed selection targets')
                report = scaled_metrics(test.qty.to_numpy()[mask], values[mask], training.qty)
                report['observedDays'] = int(mask.sum())
                folds[method].append({'start': str(test.Date.min().date()), 'trainingEnd': str(training.Date.max().date()), **report})
            except (ValueError, np.linalg.LinAlgError):
                pass
    eligible = [m for m in methods if len(folds[m]) == 8]
    if not eligible:
        raise ValueError('No portfolio method passed all selection folds')
    def loss(method):
        return float(np.mean([.5 * f['mae'] + .5 * f['period_absolute_error'] / f['observedDays'] for f in folds[method]]))
    baseline = min([m for m in eligible if m in BASELINES], key=loss)
    winner = min(eligible, key=loss)
    # Complex challengers need a 2% selection improvement over the best baseline.
    if winner not in BASELINES and loss(winner) > loss(baseline) * .98:
        winner = baseline
    comparison = {m: {'loss': loss(m), 'folds': folds[m],
        'errorDistribution': {key: distribution([f[key] for f in folds[m]]) for key in ('wape', 'mase', 'rmsse', 'bias', 'period_absolute_error')}} for m in eligible}
    records, baseline_records, evaluations = [], [], []
    # Selection is frozen before calibration and all subsequent evaluations.
    for start in range(selection_end, n - horizon + 1, horizon):
        training, test = series.iloc[:start], series.iloc[start:start + horizon]
        mask = test.get('is_observed', pd.Series(True, index=test.index)).to_numpy(dtype=bool)
        center = point_forecast(training, winner, horizon, sarima_spec)
        base = point_forecast(training, baseline, horizon, sarima_spec)
        if start >= calibration_end and mask.any() and len(records) >= 3:
            scores = scaled_metrics(test.qty.to_numpy()[mask], center[mask], training.qty)
            evaluations.append({'start': str(test.Date.min().date()),
                'trainingEnd': str(training.Date.max().date()), 'calibrationEnd': str(series.iloc[start - 1].Date.date()),
                **scores, 'baselineMAE': float(np.mean(np.abs(test.qty.to_numpy()[mask] - base[mask]))),
                'probabilistic': probabilistic_scores(test.qty.to_numpy()[mask], center[mask], np.asarray(records[-calibration_count:])[:, mask]),
                'baselineMetrics': scaled_metrics(test.qty.to_numpy()[mask], base[mask], training.qty),
                'baselineProbabilistic': probabilistic_scores(test.qty.to_numpy()[mask], base[mask], np.asarray(baseline_records[-calibration_count:])[:, mask])})
        if mask.all():
            records.append(test.qty.to_numpy() - center)
            baseline_records.append(test.qty.to_numpy() - base)
    if not evaluations or len(records) < 3:
        raise ValueError('Insufficient genuinely observed blocks for portfolio testing and calibration')
    candidate_error = sum(f['mae'] for f in evaluations)
    baseline_error = sum(f['baselineMAE'] for f in evaluations)
    promoted = winner == baseline or (len(evaluations) >= 5 and candidate_error <= baseline_error * .98)
    chosen = winner if promoted else baseline
    deployed_evaluations = evaluations if promoted else [{**f, **f['baselineMetrics'],
        'probabilistic': f['baselineProbabilistic']} for f in evaluations]
    residuals = (records if promoted else baseline_records)[-calibration_count:]
    center = point_forecast(series, chosen, horizon, sarima_spec)
    paths = forecast_paths(center, residuals)
    offset = (pd.Timestamp(dates[0]) - series.Date.max()).days - 1
    stop = offset + len(dates)
    radius, supported = finite_quantile(np.abs(residuals).ravel(), .95)
    output = pd.DataFrame({'Forecast': center[offset:stop],
        'Lower95': np.maximum(0, center[offset:stop] - radius), 'Upper95': center[offset:stop] + radius}, index=dates)
    output['Lower95'] = np.minimum(output.Lower95, output.Forecast)
    output['Upper95'] = np.maximum(output.Upper95, output.Forecast)
    report = {'version': 2, 'demandPattern': classify(series.qty), 'selectedMethod': chosen,
        'challengerMethod': winner, 'bestBaseline': baseline, 'promotionPassed': promoted,
        'selectionMetric': 'mean_daily_and_period_absolute_error', 'selectionFolds': 8,
        'selectionEnd': str(series.iloc[selection_end - 1].Date.date()),
        'configurationDiscoveryEnd': str(discovery.Date.max().date()),
        'comparison': comparison, 'outerEvaluation': deployed_evaluations, 'challengerEvaluation': evaluations,
        'forecastValueAdded': 1 - candidate_error / baseline_error if baseline_error > 0 else None,
        'targetCoverage': .95, 'coverageGuarantee': False,
        'calibrationBlocks': len(residuals), 'finiteSampleDailySupported': supported,
        'periodDemand': path_summary(paths[:, offset:stop]),
        'dailyQuantiles': {f'p{int(q * 100)}': np.quantile(paths[:, offset:stop], q, axis=0).tolist() for q in (.5, .8, .95)},
        'weeklyDecisionPreferred': classify(series.qty)['class'] in ('intermittent', 'lumpy'),
        'zeroPositiveCalibration': {'zeroDays': int((series.qty.tail(calibration_count * horizon) == 0).sum()),
            'note': 'Zero and positive coverage are reported separately; future demand state is unknown, so calibration remains unconditional.'}}
    candidate = sarima_spec or {'window': None, 'transform': 'raw', 'features': 'level',
        'order': (0, 0, 0), 'seasonal': (0, 0, 0, 7), 'trend': 'n'}
    if chosen != 'sarima':
        candidate = {'window': None, 'transform': 'raw', 'features': 'level',
            'order': (0, 0, 0), 'seasonal': (0, 0, 0, 7), 'trend': 'n'}
    selected_metrics = {k: float(np.mean([f[k] for f in deployed_evaluations if f[k] is not None])) if any(f[k] is not None for f in deployed_evaluations) else np.nan
        for k in ('mae', 'rmse', 'mape', 'smape', 'wape', 'bias', 'bias_pct', 'mase', 'rmsse')}
    counts = [f['probabilistic'] for f in deployed_evaluations]
    positive_count = sum(f['positiveDemandDays'] for f in counts)
    validation = {'days': sum(f['days'] for f in counts),
        'coveredDays': sum(f['coveredDays'] for f in counts), 'folds': len(deployed_evaluations),
        'positiveDemandDays': positive_count,
        'positiveDemandCoverage': sum(f['positiveDemandCoveredDays'] for f in counts) / positive_count if positive_count else None,
        'coverage': float(np.mean([f['coverage'] for f in counts])),
        'meanWidth': float(np.mean([f['meanWidth'] for f in counts])),
        'start': deployed_evaluations[0]['start'], 'end': str(series.Date.max().date()),
        'wape': selected_metrics['wape'] if np.isfinite(selected_metrics['wape']) else None,
        'biasPercent': selected_metrics['bias_pct'] if np.isfinite(selected_metrics['bias_pct']) else None,
        'minimumPeriodCoverage': min(f['coverage'] for f in counts)}
    training = {**candidate, 'metrics': selected_metrics, 'selection_mape': np.nan,
        'selection_metric': report['selectionMetric'], 'model_label': chosen.upper().replace('_', ' '),
        'used_cv': True, 'candidate_count': len(methods), 'portfolio': report, '_forecast_paths': paths[:, offset:],
        '_portfolio_sarima_spec': sarima_spec, '_portfolio_discovery_end': prior_date,
        'interval_calibration': {'method': 'chronological_block_residuals', 'targetCoverage': .95,
            'coverageGuarantee': False, 'maxHorizon': horizon, 'calibrationDays': len(residuals) * horizon,
            'validation': validation,
            'validationScope': 'chronological outer checks also used by promotion gate; not an untouched final holdout'},
        'modelLifecycle': {'action': 'portfolio_selection', 'trainedThrough': str(series.Date.max().date()),
            'configurationSelectedThrough': report['selectionEnd'], 'searchIntervalDays': 28,
            'metricScope': 'chronological outer tests used for promotion; validate deployment on later real sales'}}
    return training, output
