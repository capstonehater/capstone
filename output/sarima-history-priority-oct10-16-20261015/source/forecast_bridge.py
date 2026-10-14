"""Non-interactive SARIMA -> InventoryRecommendation bridge for the Nest API.

Reads a live inventory snapshot from JSON; emits one atomic result JSON.
The CSV files are training inputs, never a replacement for live stock records.
"""
import argparse
import contextlib
import hashlib
import json
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import SARIMA
from InventoryRecommendation import build_report
from catalog_reference import CATALOG_FILE, load_catalog, inventory_reference, validate_history
from pos_history import merge_pos_history
from forecast_insights import build_insights
from forecast_progress import ForecastProgress

HERE = Path(__file__).resolve().parent
SCALES = {"g": ("mass", 1), "kg": ("mass", 1000), "ml": ("volume", 1),
          "l": ("volume", 1000), "pcs": ("count", 1), "bottle": ("count", 1)}


def conversion(source, target):
    left, right = SCALES.get(source.lower()), SCALES.get(target.lower())
    if not left or not right or left[0] != right[0]:
        raise ValueError(f"Incompatible units: {source} -> {target}")
    return left[1] / right[1]


def forecast_calendar_days(start, days=7):
    return pd.date_range(pd.Timestamp(start), periods=SARIMA.validate_forecast_days(days), freq="D")


def seven_calendar_days(start):
    return forecast_calendar_days(start, 7)


def validate_history_gap(start, last):
    """Reject long unobserved gaps by default; explicit deployments may override."""
    maximum = int(os.environ.get('FORECAST_MAX_HISTORY_GAP_DAYS', '30'))
    distance = (pd.Timestamp(start) - pd.Timestamp(last)).days
    if maximum < 1 or distance > maximum:
        raise ValueError(f'Latest history is {pd.Timestamp(last).date()}; add recent records or configure FORECAST_MAX_HISTORY_GAP_DAYS (currently {maximum}).')
    return max(0, distance - 1)


def match_material(rows, materials):
    codes = set(rows['item_code'].astype(str).str.casefold())
    names = set(rows['raw_material'].astype(str).str.casefold())
    matches = [m for m in materials if m['sku'].casefold() in codes]
    if not matches:
        matches = [m for m in materials if m['name'].casefold() in names]
    if len(matches) != 1:
        raise ValueError('No unique live inventory material matches the historical name or SKU')
    return matches[0]


def select_stable_forecast(stationary, training, horizon, dates):
    """Try validated SARIMA candidates in error order; never clip implausible output."""
    ceiling = min(1e14, max(1., float(stationary['series']['qty'].max())) * 100)
    rejected = []
    for candidate in training.get('candidates', [training]):
        selected = {**training, **candidate}
        try:
            model = SARIMA.fit_full_model(stationary, selected)
            future = SARIMA.forecast_future(model, stationary, horizon=horizon, exog_cols=selected['exog_cols'])
            future = future.set_index('Date').reindex(dates).astype({'Forecast': float, 'Lower95': float, 'Upper95': float})
            numbers = future[['Forecast', 'Lower95', 'Upper95']].to_numpy()
            if not np.isfinite(numbers).all() or (numbers < 0).any():
                raise ValueError('non-finite or negative forecast values')
            if (numbers >= ceiling).any():
                raise ValueError('estimate or range exceeds 100 times the largest training-day amount or database limit')
            future['Lower95'] = np.minimum(future['Lower95'], future['Forecast'])
            future['Upper95'] = np.maximum(future['Upper95'], future['Forecast'])
            selected['range_rejections'] = rejected
            selected['range_ceiling'] = ceiling
            selected['_operational_model'] = model
            return selected, future
        except Exception as exc:
            rejected.append({'order': list(candidate['order']), 'seasonal': list(candidate['seasonal']), 'reason': str(exc)})
    raise ValueError(f'No validated SARIMA model passed the forecast range checks ({len(rejected)} candidates); material excluded from this run')


def generate(request):
    progress = ForecastProgress(request.get("progressFile"))
    forecast_days = SARIMA.validate_forecast_days(request.get('forecastDays', 7))
    source = HERE / SARIMA.CONFIG['DATASET']
    training_source = os.environ.get('FORECAST_TRAINING_SOURCE', 'mixed').lower()
    if training_source not in ('pos', 'mixed'):
        raise ValueError('FORECAST_TRAINING_SOURCE must be pos or mixed.')
    catalog = load_catalog()
    if training_source == 'pos':
        from operational_history import build_pos_history
        history, policy_map, merge_notes = build_pos_history(request, catalog, conversion)
    else:
        history = pd.read_csv(source)
        from mixed_history import select_csv_period
        history = select_csv_period(history, request['startDate'], request.get('capturedAt'))
    if history.empty:
        raise ValueError('No compatible completed POS history is available' if training_source == 'pos' else 'Historical CSV contains no usage rows')
    required = {'date', 'product', 'raw_material', 'item_code', 'quantity_used', 'unit', 'holiday'}
    if not required.issubset(history.columns):
        raise ValueError('Historical CSV is missing required columns')
    catalog = load_catalog()
    if training_source == 'mixed':
        validate_history(history, catalog)
    history['date'] = pd.to_datetime(history['date'], errors='raise').dt.normalize()
    history['quantity_used'] = pd.to_numeric(history['quantity_used'], errors='raise')
    if not np.isfinite(history['quantity_used']).all() or (history['quantity_used'] < 0).any():
        raise ValueError('History contains invalid or negative usage')
    if training_source == 'mixed':
        catalog_units = catalog[catalog.record_type.eq('RAW_MATERIAL')].set_index('sku').unit_code.to_dict()
        history, policy_map, merge_notes = merge_pos_history(history, request, match_material, conversion, catalog_units)
        from mixed_history import fill_unknown_days
        history, imputed = fill_unknown_days(history)
        merge_notes.insert(0, 'Main training history: 2024-01-01 through available 2026 CSV dates before the forecast; positive CSV daily consumption takes priority; POS fills zero or absent CSV consumption and extends history. CSV quantities are synthetic; POS quantities are actual recorded usage.')
        if imputed:
            merge_notes.append(f'{imputed} uncovered material/calendar days were estimated using earlier usage. These are model inputs, not measured demand, and are excluded from portfolio evaluation targets.')
    if history.empty:
        raise ValueError('No compatible CSV or POS history is available')
    start = pd.Timestamp(request['startDate'])
    last = history['date'].max()
    if start <= last:
        raise ValueError(f'Start date must be after {last.date()}; forecast dates cannot be used for training.')
    validate_history_gap(start, last)
    # This store operates every day. Missing weekend rows do not mean it is closed.
    business_days_only = False
    date_range = pd.bdate_range if business_days_only else pd.date_range
    dates = forecast_calendar_days(start, forecast_days)
    SARIMA.CONFIG.update(FORECAST_DAYS=forecast_days, P=[0, 1, 2], D=[0, 1], Q=[0, 1], SP=[1], SD=[0], SQ=[0], CV_FOLDS=4, BOXCOX_LAMBDA=0, BUSINESS_DAYS_ONLY=business_days_only, SEASON_LENGTH=7, CONSTRAINED_SELECTION=True)
    warnings = ['Training source: completed POS ingredient consumption with CSV history on uncovered dates; stock source: live inventory snapshot.',
                'Store operates daily, 1 PM–10 PM (Asia/Manila): SARIMA uses daily totals and seven-day seasonality, not hourly forecasts.',
                'Product filters show store-wide ingredient demand, not predicted product sales.']
    warnings.append('SARIMA compares log1p and scaled raw usage, recent/full history, Philippine holidays and weekday effects. Selection targets period usage error within a 10% MAE guard and 3% MAPE/RMSE limits relative to the reference MAPE objective. Zeros remain in absolute errors; undefined percentage errors are null.')
    warnings.append('Daily intervals target 95% coverage with up to 12 calibration periods and five later test periods excluded from the earlier model selection. A positive-usage tail guard protects against spikes; fewer than 19 positive calibration samples use the observed maximum, not a validated 95% positive-demand quantile. Measured coverage is reported separately; daily bounds are not simultaneous weekly bounds.')
    warnings.extend(merge_notes)
    warnings[0] = ('Training source: completed POS ingredient consumption only; generated CSV is development-only; stock source: live inventory snapshot.' if training_source == 'pos' else warnings[0])
    if any(not row.get('sourceUnit') for row in request.get('posHistory', [])):
        warnings.append('Some legacy POS consumption records lack a unit snapshot. Their units are assumed from the catalog; incompatible current inventory units are excluded. Verify these units before relying on estimates.')
    if os.environ.get('FORECAST_PORTFOLIO', 'auto') != 'off':
        warnings.append('Portfolio-enabled ingredients use chronological method selection by daily and period absolute error, separate residual calibration, and a later promotion check. Older SARIMA-only selection and interval rules above apply to legacy or constant-history fallbacks. Portfolio promotion tests are not an untouched deployment holdout. Supplier facts and service-level targets require review.')
    if (start - last).days > 1:
        warnings.append(f'Historical data ends {last.date()}; forecasting bridges a {(start-last).days - 1}-day gap.')
    if (start - last).days > 30:
        warnings.append('History is over 30 days old. The gap is estimated, not observed; recent sales may differ from these forecasts.')
    training_limit = int(os.environ.get('FORECAST_TRAINING_DAYS', '0'))
    if training_limit != 0 and training_limit < SARIMA.CONFIG['MIN_HISTORY']:
        raise ValueError('FORECAST_TRAINING_DAYS must be 0 (all history) or at least 60.')
    policies = inventory_reference(catalog)
    policy_file = Path(os.environ.get('FORECAST_INVENTORY_POLICY_FILE', str(HERE / 'inventory_policy.json')))
    configured_policies = json.loads(policy_file.read_text(encoding='utf-8')) if policy_file.exists() else {}
    warnings.append('Catalog identities, units and reorder points use raw-materials-and-products.csv; current stock uses the live snapshot. The catalog supplies no lead time or safety stock, so these default to zero.')
    results = []
    used = set()
    groups = history.groupby(['raw_material', 'unit'])
    progress.training(groups.ngroups)
    for (name, source_unit), group in groups:
        progress.begin(name)
        successful = False
        try:
            material = match_material(group, request['materials'])
            if material['id'] in used:
                raise ValueError('Multiple historical series map to the same live material')
            factor = conversion(source_unit, material['unit'])
            policy_info = policy_map.get(material['id'])
            raw = group.rename(columns={'date': 'transaction_date', 'product': 'product_detail', 'quantity_used': 'transaction_qty'}).copy()
            raw['transaction_qty'] *= factor
            raw['unit'] = material['unit']
            daily = SARIMA.aggregate_daily_sales(raw)
            lookup = SARIMA.build_holiday_lookup(raw)
            series = SARIMA.build_daily_series(daily, name, material['unit'], lookup)
            if 'is_observed' in group:
                coverage = group.groupby('date').is_observed.all()
                series['is_observed'] = series.Date.map(coverage).fillna(False)
            if 'history_source' in group:
                sources = group.groupby('date').history_source.first()
                series['history_source'] = series.Date.map(sources).fillna('IMPUTED')
            if len(series) < SARIMA.CONFIG['MIN_HISTORY']:
                raise ValueError('At least 60 daily observations of history are required')
            if 'is_observed' in series and int(series.is_observed.sum()) < SARIMA.CONFIG['MIN_HISTORY']:
                raise ValueError('At least 60 recorded history days are required; imputed calendar days cannot satisfy the training minimum')
            # Keep the complete uploaded history unless an explicit window is configured.
            available_days = len(series)
            from data_quality import assess
            quality = assess(series, request.get('stockoutDates', {}).get(material['id'], []))
            if quality['verifiedStockoutDates']:
                raise ValueError('Verified stockout-censored history requires reconciliation before demand forecasts; do not train on these zeros as true demand')
            if training_limit:
                series = series.tail(training_limit).reset_index(drop=True)
            stationary = {'series': series} if series['qty'].nunique() < 2 else SARIMA.make_stationary(series)
            horizon = len(date_range(series['Date'].max() + pd.Timedelta(days=1), dates[-1]))
            material_policy = configured_policies.get(material['sku'], {})
            if material_policy.get('leadTimeDays') is not None:
                required = int(material_policy['leadTimeDays']) + int(material_policy.get('reviewPeriodDays', forecast_days))
                horizon = max(horizon, (start - series.Date.max()).days - 1 + required)
                if horizon > 31:
                    raise ValueError('Configured lead time and review period exceed the supported 31-day prediction distance')
            # Check the actual prediction distance, including unobserved gap days.
            SARIMA.CONFIG['CV_HORIZON'] = horizon
            with contextlib.redirect_stdout(sys.stderr):
                if training_source in ('pos', 'mixed'):
                    from operational_forecast import forecast
                    try:
                        training, future = forecast(stationary, material, horizon, dates, select_stable_forecast)
                    except (ValueError, np.linalg.LinAlgError):
                        from model_store import load
                        if load(material['id'], material['unit']) is None:
                            raise
                        # New observations can invalidate an otherwise intact saved
                        # configuration. Try a fresh validated search once.
                        previous_force = os.environ.get('FORECAST_FORCE_FULL_RETRAIN')
                        os.environ['FORECAST_FORCE_FULL_RETRAIN'] = '1'
                        try:
                            training, future = forecast(stationary, material, horizon, dates, select_stable_forecast)
                            training['modelLifecycle']['reason'] = 'Saved configuration failed the forecast checks; a fresh validated search was used.'
                        finally:
                            if previous_force is None:
                                os.environ.pop('FORECAST_FORCE_FULL_RETRAIN', None)
                            else:
                                os.environ['FORECAST_FORCE_FULL_RETRAIN'] = previous_force
                else:
                    training = SARIMA.train_sarima(stationary)
                    training, future = select_stable_forecast(stationary, training, horizon, dates)
            model_history = series.tail(training['window']).reset_index(drop=True) if training.get('window') else series
            metrics = training['metrics']
            interval = training.get('interval_calibration')
            if interval and not training.get('portfolio'):
                from interval_calibration import requested_validation
                interval['requestedValidation'] = requested_validation(interval, (start - last).days, horizon)
            recommendation_input = future.reset_index(names='Date')
            recommendation_input['Product'] = material['name']
            recommendation_input['RawMaterial'] = material['name']
            recommendation_input['Unit'] = material['unit']
            for key in ['MAE', 'RMSE', 'MAPE', 'SMAPE']:
                recommendation_input[key] = metrics[key.lower()]
            policy = policies[policies['ItemCode'].str.casefold() == str(material['sku']).casefold()]
            policy_factor = conversion(policy.iloc[0]['Unit'], material['unit']) if len(policy) == 1 else 1
            stock_rows = []
            stock_rows.append({'Product': material['name'], 'CurrentStock': material['currentStock'],
                                   'SafetyStock': float(policy.iloc[0]['SafetyStock']) * policy_factor if len(policy) == 1 else 0,
                                   'LeadTime': float(policy.iloc[0]['LeadTime']) if len(policy) == 1 else 0,
                                   'CatalogReorderPoint': float(policy.iloc[0]['CatalogReorderPoint']) * policy_factor if len(policy) == 1 else 0})
            report = build_report(recommendation_input, pd.DataFrame(stock_rows, columns=['Product', 'CurrentStock', 'SafetyStock', 'LeadTime', 'CatalogReorderPoint']))
            recommendation = json.loads(report.to_json(orient='records'))[0]
            recommendation['stockSource'] = 'live inventory snapshot'
            if training.get('portfolio'):
                from inventory_policy import recommend
                recommendation = recommend(recommendation, training.get('_forecast_paths'), material_policy)
            recommendation['policySource'] = 'raw-materials-and-products.csv' if len(policy) == 1 else 'No catalog policy: zero reorder point, lead time and safety stock'
            if material['currentStock'] is None:
                recommendation['RecommendedPurchase'] = None
                recommendation['BuyOnNextRun'] = 'No Data'
            previous = float(raw.loc[(raw['transaction_date'] > last - pd.Timedelta(days=forecast_days)) & (raw['transaction_date'] <= last), 'transaction_qty'].sum())
            total = float(future['Forecast'].sum())
            results.append({
                'materialId': material['id'], 'name': material['name'], 'unit': material['unit'],
                'points': [{'date': day.strftime('%Y-%m-%d'), 'forecast': float(row.Forecast), 'lower95': float(row.Lower95), 'upper95': float(row.Upper95)} for day, row in future.iterrows()],
                'metadata': {'dataQuality': quality, 'portfolio': training.get('portfolio'), 'model': training.get('model_label', 'SARIMA'), 'modelLifecycle': training.get('modelLifecycle'), 'order': list(training['order']), 'seasonalOrder': list(training['seasonal']),
                             'metrics': {k: float(v) if np.isfinite(v) else None for k, v in metrics.items()},
                             'trainingDays': len(model_history), 'transformation': training.get('transform', 'log1p'),
                             'trainingWindowDays': training.get('window'),
                             'calendarFeatures': training.get('features', 'level'),
                             'predictionInterval': interval,
                             'insights': build_insights(series, training, future, material['currentStock'], {
                                 'minimumTestDays': SARIMA.CONFIG['INSIGHT_MIN_TEST_DAYS'],
                                 'minimumPositiveDays': SARIMA.CONFIG['INSIGHT_MIN_POSITIVE_DAYS'],
                                 'maximumWAPE': SARIMA.CONFIG['INSIGHT_MAX_WAPE'],
                                 'maximumHistoryGapDays': SARIMA.CONFIG['INSIGHT_MAX_HISTORY_GAP_DAYS'],
                                 'minimumPeriodCoverage': SARIMA.CONFIG['INSIGHT_MIN_PERIOD_COVERAGE']}),
                             'trend': training.get('trend', 'n'),
                             'selectionMetric': training.get('selection_metric'),
                             'selectionMAPE': float(training['selection_mape']) if np.isfinite(training.get('selection_mape', np.nan)) else None,
                             'constraints': {'maeTolerance': SARIMA.CONFIG.get('MAE_TOLERANCE', .10),
                                 'bestValidationMAE': training.get('best_validation_mae'),
                                 'maeGuardLimit': training.get('mae_guard_limit'),
                                 'operationalGuards': training.get('operational_guards'),
                                 'rejectedByMAEGuard': training.get('rejected_by_mae_guard'),
                                 'requiresConvergence': bool(training.get('constrained')),
                                 'stationarity': True, 'invertibility': True},
                             'availableTrainingDays': available_days,
                             'candidateCount': training.get('candidate_count'),
                             'validationFolds': len(training['fold_metrics']) if 'fold_metrics' in training else None,
                             'audit': training_audit(model_history, group, training, start, business_days_only),
                             'historicalProducts': sorted(group['product'].unique().tolist()), 'sourceUnit': policy_info['unit'] if policy_info else source_unit,
                             'trainingSource': 'POS-only' if training_source == 'pos' else '2024–2026 historical CSV (synthetic) + completed POS',
                             'posSnapshotAt': request.get('capturedAt'),
                             'posMaterialDays': sum(item['materialId'] == material['id'] for item in request.get('posHistory', [])),
                             'conversionFactor': policy_info['factor'] if policy_info else 1,
                             'forecastDays': forecast_days, 'previousPeriodDays': forecast_days, 'previousPeriodUsage': previous,
                             'changePercent': round((total-previous)/previous*100, 2) if previous > 0 else None},
                'recommendation': recommendation,
            })
            used.add(material['id'])
            successful = True
            print(f'Completed {name}', file=sys.stderr, flush=True)
        except Exception as exc:
            warnings.append(f'{name} ({source_unit}): {exc}')
            print(warnings[-1], file=sys.stderr, flush=True)
        finally:
            progress.complete(successful)
    progress.finalizing()
    if not results:
        raise ValueError('No forecasts could be generated. ' + ' '.join(warnings[-5:]))
    from model_store import fingerprint
    source_bytes = (training_source + ':2024-2026-v2:' + fingerprint()).encode()
    return {'historyEnd': str(last.date()), 'sourceHash': hashlib.sha256(source_bytes + CATALOG_FILE.read_bytes() + json.dumps({'posHistory': request.get('posHistory', []), 'posDates': request.get('posDates', [])}, sort_keys=True).encode()).hexdigest(), 'warnings': warnings, 'series': results}


def training_audit(series, history, training, start, business_days_only):
    """Describe the retained training window, not configured or discarded inputs."""
    dates = pd.DatetimeIndex(series['Date'])
    retained = history[history['date'].isin(dates)]
    sources = retained.get('history_source')
    return {
        'version': 1,
        'trainingStart': str(dates.min().date()),
        'trainingEnd': str(dates.max().date()),
        'csvDays': int(retained.loc[sources == 'CSV', 'date'].nunique()) if sources is not None else None,
        'posDays': int(retained.loc[sources == 'POS', 'date'].nunique()) if sources is not None else None,
        'zeroFilledDays': int((~dates.isin(retained['date'])).sum()),
        'imputedDays': int(retained.loc[sources == 'IMPUTED', 'date'].nunique()) if sources is not None else 0,
        'zeroDemandDays': int((series['qty'] == 0).sum()),
        'bridgeCalendarDays': max(0, (start - dates.max()).days - 1),
        'weekdaysOnly': bool(business_days_only),
        'successfulCandidates': training.get('successful_candidates'),
        'selectionMetric': training.get('selection_metric'),
        'selectionMAPE': float(training['selection_mape']) if np.isfinite(training.get('selection_mape', np.nan)) else None,
        'rangeRejections': training.get('range_rejections', []),
        'rangeCeiling': training.get('range_ceiling'),
        'validationMethod': ('rolling windows' if training['used_cv'] else 'single holdout') if 'used_cv' in training else None,
        'validationWindows': [{
            'start': str(fold['test']['Date'].min().date()),
            'end': str(fold['test']['Date'].max().date()),
            'days': len(fold['test']),
            'mae': float(fold['mae']) if np.isfinite(fold['mae']) else None,
            'mape': float(fold['mape']) if np.isfinite(fold['mape']) else None,
        } for fold in training.get('fold_metrics', [])],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        result = generate(json.loads(Path(args.input).read_text(encoding='utf-8-sig')))
        Path(args.output).write_text(json.dumps(result, allow_nan=False), encoding='utf-8')
    except Exception as exc:
        print(f'Forecast failed: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
