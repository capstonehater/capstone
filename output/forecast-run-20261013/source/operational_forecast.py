"""POS model lifecycle: reuse artifacts, refit selected parameters, periodic search."""
import copy
import os
import numpy as np
import pandas as pd
import SARIMA
import model_store
from constrained_sarima import metrics
from interval_calibration import build_intervals, apply


def forecast(stationary, material, horizon, dates, select):
    series = stationary['series']
    end = str(series.Date.max().date())
    enabled = os.environ.get('FORECAST_DISABLE_MODEL_CACHE') != '1'
    cached = model_store.load(material['id'], material['unit']) if enabled else None
    if cached and cached.get('kind') == 'portfolio' and os.environ.get('FORECAST_PORTFOLIO', 'auto') == 'off':
        cached = None
    if os.environ.get('FORECAST_PORTFOLIO', 'auto') != 'off' and series.qty.nunique() > 1:
        from demand_portfolio import run
        if cached and cached.get('kind') == 'portfolio' and cached['horizon'] == horizon and model_store.same_prefix(cached['history'], series) and len(cached['history']) == len(series):
            training = copy.deepcopy(cached['training'])
            training['modelLifecycle']['action'] = 'reused_portfolio'
            return training, cached['future'].reindex(dates).copy()
        if len(series) >= 81 + 16 * horizon:
            compatible_portfolio = cached and cached.get('kind') == 'portfolio' and cached['horizon'] == horizon and model_store.same_prefix(cached['history'], series)
            previous_training = cached['training'] if compatible_portfolio else None
            drift = None
            if compatible_portfolio:
                observed = series.set_index('Date').qty.reindex(cached['future'].index).dropna()
                if len(observed):
                    prediction = cached['future'].Forecast.reindex(observed.index)
                    scale = max(float(series.qty.tail(28).mean()), 1.)
                    drift = {'observedDays': len(observed), 'scaledBias': float((prediction - observed).mean() / scale),
                        'scaledMAE': float((prediction - observed).abs().mean() / scale)}
                    if abs(drift['scaledBias']) > .3 or drift['scaledMAE'] > 1:
                        previous_training = None
            try:
                training, future = run(series, horizon, dates, previous_training)
            except (ValueError, np.linalg.LinAlgError) as exc:
                # A selected statistical fit can still fail in a later calibration
                # or full-data refit. Re-run all chronological checks for robust
                # baselines instead of inheriting the failed model's residuals.
                training, future = run(series, horizon, dates, conservative=True)
                training['portfolio']['fallbackReason'] = str(exc)
                training['modelLifecycle']['reason'] = 'Statistical refit failed; a baseline passed fresh chronological selection, calibration and testing.'
            training['portfolio']['driftMonitor'] = drift
            if enabled:
                saved = model_store.save(material['id'], material['unit'], {'kind': 'portfolio', 'history': series.copy(),
                    'training': training, 'future': future, 'horizon': horizon, 'selectionEnd': end, 'model': None})
                training['modelLifecycle']['artifactSaved'] = saved
            return training, future
        cached = None if cached and cached.get('kind') == 'portfolio' else cached
    fresh = os.environ.get('FORECAST_FORCE_FULL_RETRAIN') == '1'
    action = 'trained'
    compatible = (cached is not None and cached['horizon'] == horizon
                  and model_store.same_prefix(cached['history'], series))
    if compatible and len(series) > len(cached['history']):
        prior = cached['history'].qty.tail(28)
        recent = series.qty.tail(28)
        ratio = float(recent.mean()) / max(float(prior.mean()), 1e-8)
        if ratio > 3 or ratio < 1 / 3 or abs(float((recent > 0).mean() - (prior > 0).mean())) > .3:
            fresh = True
    if series.qty.nunique() < 2:
        training, future = constant_baseline(series, horizon, dates)
        training['modelLifecycle'] = {'action': 'baseline', 'trainedThrough': end,
            'metricScope': 'constant history baseline; no identifiable SARIMA fit',
            'reason': 'Constant completed POS history; SARIMA parameters are not identifiable.'}
        return training, future
    if compatible and not fresh and len(cached['history']) == len(series):
        training = copy.deepcopy(cached['training'])
        model = cached['model']
        future = SARIMA.forecast_future(model, stationary, horizon=horizon,
            exog_cols=training['exog_cols']).set_index('Date').reindex(dates)
        action = 'reused'
        selection_end = cached['selectionEnd']
    elif compatible and not fresh and (pd.Timestamp(end) - pd.Timestamp(cached['selectionEnd'])).days < 28:
        # Re-estimate only the validated configuration on the latest observations.
        # This preserves selected rolling-window length, unlike blindly appending.
        training = copy.deepcopy(cached['training'])
        training.pop('candidates', None)
        training.pop('interval_cached_folds', None)
        earlier = training.get('interval_validation_candidate')
        if earlier:
            earlier.pop('interval_cached_folds', None)
        if training.get('interval_plan'):
            training['interval_plan']['selectionEnd'] = len(series) - horizon * 5
        training, future = select(stationary, training, horizon, dates)
        model = training.pop('_operational_model')
        action = 'refit_selected'
        selection_end = cached['selectionEnd']
    else:
        training = SARIMA.train_sarima(stationary)
        training, future = select(stationary, training, horizon, dates)
        model = training.pop('_operational_model')
        selection_end = end
        action = 'reselected' if cached else 'trained'
    saved = False
    if enabled and action != 'reused':
        retained = {k: v for k, v in training.items() if k not in ('model', 'candidates')}
        saved = model_store.save(material['id'], material['unit'], {
            'history': series.copy(), 'training': retained, 'model': model,
            'horizon': horizon, 'selectionEnd': selection_end})
    training['modelLifecycle'] = {'action': action, 'trainedThrough': end,
        'configurationSelectedThrough': selection_end, 'searchIntervalDays': 28,
        'artifactSaved': saved, 'metricScope': 'last full chronological model selection'}
    return training, future


def constant_baseline(series, horizon, dates):
    candidate = {'order': (0, 0, 0), 'seasonal': (0, 0, 0, 7), 'window': None,
        'transform': 'raw', 'features': 'level', 'trend': 'n',
        'model_type': 'seasonal_naive', 'exog_cols': []}
    training = {**candidate, 'metrics': metrics(series.qty.tail(7), series.qty.tail(7)),
        'selection_mape': np.nan, 'candidate_count': 0, 'used_cv': False,
        'model_label': 'Seasonal naive (constant POS usage)'}
    if len(series) >= 60 + horizon * 17:
        training['interval_plan'] = {'horizon': horizon, 'selectionEnd': len(series) - horizon * 5,
            'calibrationFolds': 12, 'evaluationFolds': 5, 'positiveDemandGuard': True}
        training['interval_validation_candidate'] = candidate.copy()
        interval = build_intervals(series, training)
    else:
        interval = {'method': 'uncalibrated_baseline', 'targetCoverage': .95,
            'coverageGuarantee': False, 'validation': None,
            'reason': 'Insufficient history for chronological interval validation'}
    training['interval_calibration'] = interval
    centers = np.resize(series.qty.tail(7).to_numpy(), horizon)
    values = apply(np.column_stack([centers, centers, centers]), interval)
    future_dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=horizon)
    return training, pd.DataFrame(values, index=future_dates,
        columns=['Forecast', 'Lower95', 'Upper95']).reindex(dates)
