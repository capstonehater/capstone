"""Attach validation sample counts to the completed isolated experiment."""
import json
import hashlib
import importlib.metadata
from datetime import date, timedelta
from pathlib import Path
from collections import Counter
from statistics import median
root = Path(__file__).resolve().parent
data = json.loads((root / 'results.json').read_text(encoding='utf-8'))
request = json.loads((root / 'input.json').read_text(encoding='utf-8'))
assert len(data['materials']) == len(request['materials']), 'Run is still incomplete'
coverage = set(request['posDates'])
positive = {}
for row in request['posHistory']:
    if row['quantity'] > 0:
        positive.setdefault(row['materialId'], set()).add(row['date'])
for row in data['materials']:
    if row['status'] == 'failed':
        continue
    end = date.fromisoformat(row['historyEnd'])
    count = row.get('folds', 4) * row['horizonIncludingGap']
    start = end - timedelta(days=count - 1)
    window = {(start + timedelta(days=i)).isoformat() for i in range(count)}
    row['validationStart'] = start.isoformat()
    row['validationEnd'] = end.isoformat()
    row['validationPOSDays'] = len(window & coverage)
    row['positiveValidationPOSDays'] = len(window & positive.get(row['materialId'], set()))
data['completed'] = True
data['manifest']['runnerHash'] = hashlib.sha256((root / 'run.py').read_bytes()).hexdigest()
data['manifest']['dependencyVersions'] = {name: importlib.metadata.version(name) for name in
                                        ('numpy', 'pandas', 'scipy', 'statsmodels', 'threadpoolctl')}
source = root.parent.parent / 'python' / 'historical-raw-material-data.csv'
with source.open('rb') as stream:
    data['manifest']['historicalCSVHash'] = hashlib.file_digest(stream, 'sha256').hexdigest()
data['manifest']['legacyPOSUnitRows'] = sum(not row.get('sourceUnit') for row in request['posHistory'])
(root / 'results.json').write_text(json.dumps(data, indent=2, allow_nan=False), encoding='utf-8')
values = [r['cvMAPE'] for r in data['materials'] if r.get('cvMAPE') is not None]
statuses = dict(Counter(r['status'] for r in data['materials']))
lines = ['# Seven-day SARIMA results', '', '**Forecast period: October 14–20, 2026.**', '',
    f"Completed: {statuses.get('SARIMA', 0)} SARIMA fits, {statuses.get('constant baseline', 0)} constant baselines, {statuses.get('failed', 0)} exclusions. All {len(data['materials'])} active materials are listed.", '',
    'This is a direct SARIMA/SARIMAX experiment in a separate Python virtual environment with frozen source code. It does not apply the app portfolio’s simpler-method promotion routing. The database and saved app forecasts were not modified.', '',
    'Inputs: 2024–2026 synthetic CSV history plus a read-only completed POS snapshot through October 12. Typical history contains 1,016 days: 645 CSV, 368 recorded POS, and 3 causally estimated gap days. The model may select a recent fitting window.', '',
    f"POS unit provenance: {data['manifest']['legacyPOSUnitRows']:,} material/day totals lack saved source-unit codes. They use catalog-unit assumptions, matching the current bridge fallback; those quantities are not independently verified unit snapshots.", '',
    'CV MAPE is positive-day rolling **selection error**, not accuracy on the future week or an independent final holdout. Four chronological windows use the forecast distance including the unobserved history gap. For these fits the validation period is September 11–October 12, using recorded POS targets; estimated gap targets are excluded. Undefined MAPE is shown as —, not zero.', '',
    f"Median defined CV MAPE: **{median(values):.2f}%** across {len(values)} materials. Values vary by material and positive-day sample size; this does not establish improved accuracy versus previous runs on different dates.", '',
    'Quantities are ingredient usage in the displayed live inventory unit, rounded to two decimal places. Exact values and uncalibrated model-based daily 95% bounds are in results.json; these bounds are not weekly-total intervals or measured coverage.', '',
    '## Per-material summary', '',
    '| Material | Unit | 7-day forecast | CV MAPE (% error) | CV MAE | Positive POS days in CV | Available / fitting days | Status |',
    '|---|---|---:|---:|---:|---:|---:|---|']
fmt = lambda v: '—' if v is None else f'{v:,.2f}'
for row in data['materials']:
    lines.append(f"| {row['name']} | {row['unit']} | {fmt(row.get('total'))} | {fmt(row.get('cvMAPE'))} | {fmt(row.get('cvMAE'))} | {row.get('positiveValidationPOSDays', '—')} | {row.get('availableDays', 0)} / {row.get('fittingDays', '—')} | {row['status']} |")
lines += ['', '## Daily predictions', '']
for row in data['materials']:
    lines += [f"### {row['name']} ({row['unit']})", '']
    if row['status'] == 'failed':
        lines += [row['reason'], '']
        continue
    config = row.get('configuration')
    if config:
        lines += [f"Selected configuration: order {config['order']}, seasonal order {config['seasonal']}, {config['transform']} transform, {config['features']} features; {row['fittingDays']} fitting days.", '']
    lines += ['| Date | Predicted usage |', '|---|---:|']
    lines += [f"| {p['date']} | {p['forecast']:,.2f} |" for p in row['points']]
    lines += ['']
(root / 'per-material-results.md').write_text('\n'.join(lines), encoding='utf-8')
print(f'Final report written for {len(data["materials"])} materials. Median CV MAPE: {median(values):.2f}%')
