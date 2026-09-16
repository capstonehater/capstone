"""Non-interactive SARIMA -> InventoryRecommendation bridge for the Nest API.

Reads a live inventory snapshot from JSON; emits one atomic result JSON.
The CSV files are training inputs, never a replacement for live stock records.
"""
import argparse
import contextlib
import hashlib
import json
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


def seven_calendar_days(start):
    return pd.date_range(pd.Timestamp(start), periods=7, freq="D")


def match_material(rows, materials):
    codes = set(rows['item_code'].astype(str).str.casefold())
    names = set(rows['raw_material'].astype(str).str.casefold())
    matches = [m for m in materials if m['sku'].casefold() in codes]
    if not matches:
        matches = [m for m in materials if m['name'].casefold() in names]
    if len(matches) != 1:
        raise ValueError('No unique live inventory material matches the historical name or SKU')
    return matches[0]


def generate(request):
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
    if start <= last or start > last + pd.Timedelta(days=60):
        raise ValueError(f'Start date must be after {last.date()} and within 60 days of the latest history.')
    business_days_only = not (history['date'].dt.dayofweek >= 5).any()
    date_range = pd.bdate_range if business_days_only else pd.date_range
    dates = seven_calendar_days(start)
    # Four SARIMA candidates, three rolling validation folds. Full CLI grid remains available.
    SARIMA.CONFIG.update(P=[0, 1], Q=[0, 1], SP=[1], SD=[0], SQ=[0], CV_FOLDS=3, BOXCOX_LAMBDA=0, BUSINESS_DAYS_ONLY=business_days_only, SEASON_LENGTH=5 if business_days_only else 7)
    warnings = ['Training source: completed POS ingredient consumption with CSV history on uncovered dates; stock source: live inventory snapshot.',
                'Weekday-only history: weekend forecasts are zero.' if business_days_only else 'POS includes weekend activity: SARIMA uses daily observations and seven-day seasonality.',
                'Product filters show store-wide ingredient demand, not predicted product sales.']
    warnings.append('SARIMA uses log1p (Box-Cox lambda 0) to support zero-demand days without invalid inverse-transform bounds.')
    warnings.extend(merge_notes)
    if (start - last).days > 1:
        warnings.append(f'Historical data ends {last.date()}; forecasting bridges a {(start-last).days - 1}-day gap.')
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
            # Limit runtime without silently substituting a different forecasting model.
            series = series.tail(260).reset_index(drop=True)
            if series['qty'].nunique() < 2:
                raise ValueError('Constant history cannot be fitted with the Box-Cox SARIMA pipeline')
            stationary = SARIMA.make_stationary(series)
            with contextlib.redirect_stdout(sys.stderr):
                training = SARIMA.train_sarima(stationary)
                model = SARIMA.fit_full_model(stationary, training)
                horizon = len(date_range(series['Date'].max() + pd.Timedelta(days=1), dates[-1]))
                future = SARIMA.forecast_future(model, stationary, horizon=horizon, exog_cols=training['exog_cols'])
            future = future.set_index('Date').reindex(dates)
            weekends = future.index.dayofweek >= 5
            if business_days_only:
                future.loc[weekends, ['Forecast', 'Lower95', 'Upper95']] = 0
            numbers = future[['Forecast', 'Lower95', 'Upper95']].to_numpy()
            if not np.isfinite(numbers).all():
                raise ValueError('SARIMA returned non-finite estimates or confidence bounds')
            future['Lower95'] = np.minimum(future['Lower95'], future['Forecast'])
            future['Upper95'] = np.maximum(future['Upper95'], future['Forecast'])
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
            previous = float(raw.loc[(raw['transaction_date'] > last - pd.Timedelta(days=7)) & (raw['transaction_date'] <= last), 'transaction_qty'].sum())
            total = float(future['Forecast'].sum())
            results.append({
                'materialId': material['id'], 'name': material['name'], 'unit': material['unit'],
                'points': [{'date': day.strftime('%Y-%m-%d'), 'forecast': float(row.Forecast), 'lower95': float(row.Lower95), 'upper95': float(row.Upper95)} for day, row in future.iterrows()],
                'metadata': {'model': 'SARIMA', 'order': list(training['order']), 'seasonalOrder': list(training['seasonal']),
                             'metrics': {k: float(v) if np.isfinite(v) else None for k, v in metrics.items()},
                             'trainingDays': len(series), 'transformation': 'log1p (Box-Cox lambda 0)', 'candidateCount': 4, 'validationFolds': 3,
                             'historicalProducts': sorted(group['product'].unique().tolist()), 'sourceUnit': policy_info['unit'] if policy_info else source_unit,
                             'trainingSource': 'POS + CSV' if request.get('posDates') else 'CSV',
                             'posSnapshotAt': request.get('capturedAt'),
                             'posMaterialDays': sum(item['materialId'] == material['id'] for item in request.get('posHistory', [])),
                             'conversionFactor': policy_info['factor'] if policy_info else 1, 'previous7Days': previous,
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
