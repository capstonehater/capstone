"""Read-only, isolated direct SARIMA experiment. No app forecast writes."""
import os
os.environ.update(OMP_NUM_THREADS='1', OPENBLAS_NUM_THREADS='1', MKL_NUM_THREADS='1', PYTHONUTF8='1')
import sys
import json
import hashlib
import time
import traceback
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
import numpy as np
import pandas as pd
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / 'source'))
import SARIMA
import constrained_sarima as cs


def material_run(payload):
    material, data, dates = payload
    began = time.perf_counter()
    series = pd.DataFrame(data)
    series['Date'] = pd.to_datetime(series.Date)
    dates = pd.DatetimeIndex(dates)
    horizon = (dates[-1] - series.Date.max()).days
    base = {'materialId': material['id'], 'name': material['name'], 'sku': material['sku'],
            'unit': material['unit'], 'availableDays': len(series), 'historyEnd': str(series.Date.max().date()),
            'sourceDays': series.history_source.value_counts().to_dict(), 'horizonIncludingGap': horizon}
    try:
        SARIMA.CONFIG.update(FORECAST_DAYS=7, CV_HORIZON=horizon, CV_FOLDS=4,
                             INTERVAL_VALIDATION_FOLDS=0, BUSINESS_DAYS_ONLY=False)
        if len(series) < 60:
            raise ValueError('Fewer than 60 history days')
        if series.qty.nunique() < 2:
            prediction = np.repeat(float(series.qty.iloc[-1]), len(dates))
            return {**base, 'status': 'constant baseline', 'total': float(prediction.sum()),
                    'cvMAPE': None, 'cvMAE': None, 'fittingDays': len(series),
                    'points': [{'date': str(day.date()), 'forecast': float(value)} for day, value in zip(dates, prediction)],
                    'seconds': time.perf_counter() - began}
        selected = cs.train({'series': series}, SARIMA.CONFIG)
        model = cs.fit(series, selected)
        full_dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=horizon)
        values = cs.predict(model, full_dates, SARIMA.future_holiday_flags(full_dates).to_numpy(), interval=True)
        offset = (dates[0] - full_dates[0]).days
        points = values[offset:offset + len(dates)]
        safe = lambda value: float(value) if np.isfinite(value) else None
        return {**base, 'status': 'SARIMA', 'total': float(points[:, 0].sum()),
            'fittingDays': model._cafe_candidate['training_days'], 'configuration': {key: selected[key] for key in
              ('window', 'transform', 'features', 'order', 'seasonal', 'trend')},
            'cvMAPE': safe(selected['selection_mape']),
            'reportedFoldMAPE': safe(selected['metrics']['mape']),
            'cvMAE': safe(selected['metrics']['mae']), 'cvRMSE': safe(selected['metrics']['rmse']),
            'cvWAPE': safe(selected['metrics']['wape']), 'cvPeriodVolumeError': safe(selected['metrics']['period_volume_error']),
            'selectionMetric': selected['selection_metric'], 'successfulCandidates': selected['successful_candidates'],
            'candidateCount': selected['candidate_count'], 'folds': len(selected['fold_metrics']),
            'points': [{'date': str(day.date()), 'forecast': float(row[0]),
                       'modelLower95': float(row[1]), 'modelUpper95': float(row[2])} for day, row in zip(dates, points)],
            'seconds': time.perf_counter() - began}
    except Exception as exc:
        return {**base, 'status': 'failed', 'reason': str(exc), 'seconds': time.perf_counter() - began}


def write_results(results, request, notes, manifest):
    ordered = sorted(results, key=lambda row: row['name'].casefold())
    payload = {'forecastStart': request['startDate'], 'forecastEnd': '2026-10-20', 'forecastDays': 7,
      'capturedAt': request['capturedAt'], 'purpose': 'isolated direct SARIMA experiment',
      'mapeScope': 'positive-day rolling selection MAPE; not future or independent held-out accuracy',
      'rangeScope': 'model-based pointwise 95% bounds; not calibrated empirical coverage or a weekly-total interval',
      'manifest': manifest, 'notes': notes, 'materials': ordered}
    temporary = HERE / 'results.tmp.json'
    temporary.write_text(json.dumps(payload, indent=2, allow_nan=False), encoding='utf-8')
    temporary.replace(HERE / 'results.json')
    lines = ['# Seven-day SARIMA results', '', 'Forecast: **October 14–20, 2026**. Separate virtual environment; production forecasts and database unchanged.',
      '', 'Training: 2024–2026 synthetic CSV base with completed POS replacements/extensions. Unknown days are marked as estimates.',
      '', 'MAPE below is positive-day rolling **selection validation**, not measured accuracy for the future week. Undefined values are shown as —.',
      '', '| Material | Unit | 7-day forecast | CV MAPE (%) | CV MAE | Available days | Fitting days | Status |',
      '|---|---|---:|---:|---:|---:|---:|---|']
    fmt = lambda value: '—' if value is None else f'{value:,.2f}'
    for row in ordered:
        lines.append(f"| {row['name']} | {row['unit']} | {fmt(row.get('total'))} | {fmt(row.get('cvMAPE'))} | {fmt(row.get('cvMAE'))} | {row.get('availableDays', 0)} | {row.get('fittingDays', '—')} | {row['status']} |")
    lines += ['', '## Daily forecast per material', '']
    for row in ordered:
        lines += [f"### {row['name']} ({row['unit']})", '']
        if row['status'] == 'failed':
            lines += [row['reason'], '']
            continue
        lines += ['| Date | Predicted usage |', '|---|---:|']
        lines += [f"| {p['date']} | {p['forecast']:,.2f} |" for p in row['points']]
        lines += ['']
    (HERE / 'per-material-results.md').write_text('\n'.join(lines), encoding='utf-8')


def main():
    from mixed_history import select_csv_period, fill_unknown_days
    from pos_history import merge_pos_history
    from forecast_bridge import match_material, conversion, validate_history_gap
    from catalog_reference import load_catalog, validate_history
    request = json.loads((HERE / 'input.json').read_text(encoding='utf-8'))
    source = HERE.parent.parent / 'python' / 'historical-raw-material-data.csv'
    workers = int(os.environ.get('SARIMA_EXPERIMENT_WORKERS', '8'))
    manifest = {'python': sys.version, 'executable': sys.executable,
                'codeHash': hashlib.sha256(b''.join(p.read_bytes() for p in sorted((HERE / 'source').glob('*.py')))).hexdigest(),
                'workers': workers, 'cvFolds': 4, 'maxiter': 100, 'intervalOuterTesting': False,
                'inputHash': hashlib.sha256((HERE / 'input.json').read_bytes()).hexdigest()}
    history = select_csv_period(pd.read_csv(source), request['startDate'], request['capturedAt'])
    catalog = load_catalog()
    validate_history(history, catalog)
    units = catalog[catalog.record_type.eq('RAW_MATERIAL')].set_index('sku').unit_code.to_dict()
    history, _, notes = merge_pos_history(history, request, match_material, conversion, units)
    history, imputed = fill_unknown_days(history)
    notes.append(f'{imputed} unknown material/date inputs estimated causally; excluded from selection scores.')
    dates = pd.date_range(request['startDate'], periods=7)
    resume = HERE / 'resume.json'
    results = json.loads(resume.read_text(encoding='utf-8'))['materials'] if resume.exists() else []
    completed_ids = {row['materialId'] if 'materialId' in row else row['id'] for row in results}
    jobs = []
    for material in request['materials']:
        if material['id'] in completed_ids:
            continue
        group = history[history.material_id.eq(material['id'])]
        if group.empty:
            results.append({**material, 'status': 'failed', 'reason': 'No compatible CSV or completed POS usage history'})
            continue
        daily = group.groupby('date').agg(qty=('quantity_used', 'sum'), is_observed=('is_observed', 'all'),
                                         history_source=('history_source', 'first'), holiday=('holiday', 'first')).reset_index()
        validate_history_gap(request['startDate'], daily.date.max())
        daily['is_holiday'] = daily.holiday.astype(str).str.upper().isin(['YES', 'TRUE', '1']).astype(int)
        daily = daily.rename(columns={'date': 'Date'}).drop(columns='holiday')
        daily['Date'] = daily.Date.dt.strftime('%Y-%m-%d')
        jobs.append((material, daily.to_dict(orient='list'), dates.strftime('%Y-%m-%d').tolist()))
    write_results(results, request, notes, manifest)
    print(f'Prepared {len(jobs)} remaining material jobs; {len(results)} saved results. Starting {workers} isolated processes.', flush=True)
    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(material_run, job): job[0] for job in jobs}
        for future in as_completed(futures):
            row = future.result()
            results.append(row)
            write_results(results, request, notes, manifest)
            print(f"{len(results)}/{len(request['materials'])} {row['name']}: {row['status']}; MAPE={row.get('cvMAPE')}; total={row.get('total')}", flush=True)
    print('Finished; per-material-results.md and results.json written.', flush=True)


if __name__ == '__main__':
    main()
