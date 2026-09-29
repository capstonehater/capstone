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
from pos_history import merge_pos_history

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
            return selected, future
        except Exception as exc:
            rejected.append({'order': list(candidate['order']), 'seasonal': list(candidate['seasonal']), 'reason': str(exc)})
    raise ValueError(f'No validated SARIMA model passed the forecast range checks ({len(rejected)} candidates); material excluded from this run')


def generate(request):
    forecast_days = SARIMA.validate_forecast_days(request.get('forecastDays', 7))
    source = HERE / 'cafe_raw_material_daily_consumption.csv'
    history = pd.read_csv(source)
    required = {'date', 'product', 'raw_material', 'item_code', 'quantity_used', 'unit', 'holiday'}
    if not required.issubset(history.columns):
        raise ValueError('Historical CSV is missing required columns')
    history['date'] = pd.to_datetime(history['date'], errors='raise').dt.normalize()
    history['quantity_used'] = pd.to_numeric(history['quantity_used'], errors='raise')
    if not np.isfinite(history['quantity_used']).all() or (history['quantity_used'] < 0).any():
        raise ValueError('History contains invalid or negative usage')
    history, policy_map, merge_notes = merge_pos_history(history, request, match_material, conversion)
    if history.empty:
        raise ValueError('No compatible CSV or POS history is available')
    start = pd.Timestamp(request['startDate'])
    last = history['date'].max()
    if start <= last:
        raise ValueError(f'Start date must be after {last.date()}; forecast dates cannot be used for training.')
    max_gap = int(os.environ.get('FORECAST_MAX_HISTORY_GAP_DAYS', '365'))
    if max_gap < 1 or (start - last).days > max_gap:
        raise ValueError(f'Latest history is {last.date()}; add recent records or configure FORECAST_MAX_HISTORY_GAP_DAYS (currently {max_gap}).')
    # This store operates every day. Missing weekend rows do not mean it is closed.
    business_days_only = False
    date_range = pd.bdate_range if business_days_only else pd.date_range
    dates = forecast_calendar_days(start, forecast_days)
    # Compare differenced and undifferenced models instead of forcing a random walk.
    SARIMA.CONFIG.update(FORECAST_DAYS=forecast_days, P=[0, 1], D=[0, 1], Q=[0, 1], SP=[1], SD=[0], SQ=[0], CV_FOLDS=3, BOXCOX_LAMBDA=0, BUSINESS_DAYS_ONLY=business_days_only, SEASON_LENGTH=7)
    warnings = ['Training source: completed POS ingredient consumption with CSV history on uncovered dates; stock source: live inventory snapshot.',
                'Store operates daily, 1 PM–10 PM (Asia/Manila): SARIMA uses daily totals and seven-day seasonality, not hourly forecasts.',
                'Product filters show store-wide ingredient demand, not predicted product sales.']
    warnings.append('SARIMA uses log1p (Box-Cox lambda 0) to support zero-demand days without invalid inverse-transform bounds.')
    warnings.extend(merge_notes)
    if (start - last).days > 1:
        warnings.append(f'Historical data ends {last.date()}; forecasting bridges a {(start-last).days - 1}-day gap.')
    if (start - last).days > 30:
        warnings.append('History is over 30 days old. The gap is estimated, not observed; recent sales may differ from these forecasts.')
    training_limit = int(os.environ.get('FORECAST_TRAINING_DAYS', '0'))
    if training_limit != 0 and training_limit < SARIMA.CONFIG['MIN_HISTORY']:
        raise ValueError('FORECAST_TRAINING_DAYS must be 0 (all history) or at least 60.')
    policies = pd.read_csv(HERE / 'current_inventory.csv')
    warnings.append('Lead time and safety stock use current_inventory.csv policies in the matching historical unit. Its CurrentStock values are not used.')
    results = []
    used = set()
    for (name, source_unit), group in history.groupby(['raw_material', 'unit']):
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
            if len(series) < SARIMA.CONFIG['MIN_HISTORY']:
                raise ValueError('At least 60 daily observations of history are required')
            # Keep the complete uploaded history unless an explicit window is configured.
            available_days = len(series)
            if training_limit:
                series = series.tail(training_limit).reset_index(drop=True)
            if series['qty'].nunique() < 2:
                raise ValueError('Constant history cannot be fitted with the Box-Cox SARIMA pipeline')
            stationary = SARIMA.make_stationary(series)
            horizon = len(date_range(series['Date'].max() + pd.Timedelta(days=1), dates[-1]))
            # Check the actual prediction distance, including unobserved gap days.
            SARIMA.CONFIG['CV_HORIZON'] = horizon
            with contextlib.redirect_stdout(sys.stderr):
                training = SARIMA.train_sarima(stationary)
                training, future = select_stable_forecast(stationary, training, horizon, dates)
            metrics = training['metrics']
            recommendation_input = future.reset_index(names='Date')
            recommendation_input['Product'] = material['name']
            recommendation_input['RawMaterial'] = material['name']
            recommendation_input['Unit'] = material['unit']
            for key in ['MAE', 'RMSE', 'MAPE', 'SMAPE']:
                recommendation_input[key] = metrics[key.lower()]
            policy = policies[policies['Product'].str.casefold() == str(policy_info['name']).casefold()] if policy_info else policies.iloc[0:0]
            stock_rows = []
            if material['currentStock'] is not None:
                stock_rows.append({'Product': material['name'], 'CurrentStock': material['currentStock'],
                                   'SafetyStock': float(policy.iloc[0]['SafetyStock']) * policy_info['factor'] if len(policy) == 1 else 0,
                                   'LeadTime': float(policy.iloc[0]['LeadTime']) if len(policy) == 1 else 0})
            report = build_report(recommendation_input, pd.DataFrame(stock_rows, columns=['Product', 'CurrentStock', 'SafetyStock', 'LeadTime']))
            recommendation = json.loads(report.to_json(orient='records'))[0]
            recommendation['stockSource'] = 'live inventory snapshot'
            recommendation['policySource'] = 'current_inventory.csv' if len(policy) == 1 else 'No policy: zero lead time and safety stock'
            if material['currentStock'] is None:
                recommendation['RecommendedPurchase'] = None
                recommendation['BuyOnNextRun'] = 'No Data'
            previous = float(raw.loc[(raw['transaction_date'] > last - pd.Timedelta(days=forecast_days)) & (raw['transaction_date'] <= last), 'transaction_qty'].sum())
            total = float(future['Forecast'].sum())
            results.append({
                'materialId': material['id'], 'name': material['name'], 'unit': material['unit'],
                'points': [{'date': day.strftime('%Y-%m-%d'), 'forecast': float(row.Forecast), 'lower95': float(row.Lower95), 'upper95': float(row.Upper95)} for day, row in future.iterrows()],
                'metadata': {'model': 'SARIMA', 'order': list(training['order']), 'seasonalOrder': list(training['seasonal']),
                             'metrics': {k: float(v) if np.isfinite(v) else None for k, v in metrics.items()},
                             'trainingDays': len(series), 'transformation': 'log1p (Box-Cox lambda 0)',
                             'availableTrainingDays': available_days,
                             'candidateCount': training.get('candidate_count'),
                             'validationFolds': len(training['fold_metrics']) if 'fold_metrics' in training else None,
                             'audit': training_audit(series, group, training, start, business_days_only),
                             'historicalProducts': sorted(group['product'].unique().tolist()), 'sourceUnit': policy_info['unit'] if policy_info else source_unit,
                             'trainingSource': 'POS + CSV' if request.get('posDates') else 'CSV',
                             'posSnapshotAt': request.get('capturedAt'),
                             'posMaterialDays': sum(item['materialId'] == material['id'] for item in request.get('posHistory', [])),
                             'conversionFactor': policy_info['factor'] if policy_info else 1,
                             'forecastDays': forecast_days, 'previousPeriodDays': forecast_days, 'previousPeriodUsage': previous,
                             'changePercent': round((total-previous)/previous*100, 2) if previous > 0 else None},
                'recommendation': recommendation,
            })
            used.add(material['id'])
            print(f'Completed {name}', file=sys.stderr, flush=True)
        except Exception as exc:
            warnings.append(f'{name} ({source_unit}): {exc}')
            print(warnings[-1], file=sys.stderr, flush=True)
    if not results:
        raise ValueError('No forecasts could be generated. ' + ' '.join(warnings[-5:]))
    return {'historyEnd': str(last.date()), 'sourceHash': hashlib.sha256(source.read_bytes() + json.dumps({'posHistory': request.get('posHistory', []), 'posDates': request.get('posDates', [])}, sort_keys=True).encode()).hexdigest(), 'warnings': warnings, 'series': results}


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
        'zeroDemandDays': int((series['qty'] == 0).sum()),
        'bridgeCalendarDays': max(0, (start - dates.max()).days - 1),
        'weekdaysOnly': bool(business_days_only),
        'successfulCandidates': training.get('successful_candidates'),
        'selectionMetric': training.get('selection_metric'),
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
