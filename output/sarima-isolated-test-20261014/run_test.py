import sys, json, copy, time, warnings, contextlib, hashlib
from pathlib import Path
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / 'source'))
import numpy as np
import pandas as pd
import SARIMA
import forecast_bridge as bridge
from operational_history import build_pos_history
catalog = bridge.load_catalog()
refs = catalog[catalog.record_type.eq('RAW_MATERIAL')]
ref = refs[refs.unit_code.eq('ml')].iloc[0]
other = refs[refs.sku.ne(ref.sku)].iloc[0]
base = {'id': 'fixture-valid', 'sku': ref.sku, 'name': ref['name'], 'unit': 'ml', 'currentStock': 1000.}
constant = {'id': 'fixture-constant', 'sku': other.sku, 'name': other['name'], 'unit': other.unit_code, 'currentStock': 500.}
new = {'id': 'fixture-new', 'sku': 'TEST-NEW-NOT-IN-CSV', 'name': 'New enrolled ingredient', 'unit': 'g', 'currentStock': 300.}
dates = pd.date_range('2026-07-16', '2026-10-13')
request = {'startDate': '2026-10-14', 'capturedAt': '2026-10-14T05:00:00Z', 'forecastDays': 7,
    'materials': [base, constant, new], 'posDates': [str(d.date()) for d in dates],
    'posHistory': [{'materialId': base['id'], 'date': str(d.date()), 'sourceUnit': 'l',
        'quantity': round((1200 + d.dayofweek * 90 + (i % 5) * 13) / 1000, 3)} for i,d in enumerate(dates)]}
(ROOT / 'request.json').write_text(json.dumps(request, indent=2))
checks = []
def check(name, condition, detail):
    checks.append({'test': name, 'passed': bool(condition), 'detail': detail})
def rejects(name, edited, phrase):
    try:
        build_pos_history(edited, catalog, bridge.conversion)
        check(name, False, 'Unexpectedly accepted')
    except ValueError as exc:
        check(name, phrase in str(exc), str(exc))
history, _, notes = build_pos_history(request, catalog, bridge.conversion)
check('POS liter-to-milliliter conversion', history[history.material_id.eq(base['id'])].quantity_used.iloc[0] == request['posHistory'][0]['quantity'] * 1000, 'Source unit l converted to enrolled unit ml')
check('New material absent from CSV catalog', not history.material_id.eq(new['id']).any(), next(n for n in notes if new['name'] in n))
for name, mutate, phrase in [
    ('No completed POS coverage', lambda r: r.update(posDates=[]), 'No complete POS days'),
    ('Partial current Philippine day', lambda r: r['posDates'].append('2026-10-14'), 'forecast dates'),
    ('Negative ledger consumption', lambda r: r['posHistory'][0].update(quantity=-1), 'Invalid POS consumption'),
    ('Consumption outside covered dates', lambda r: r['posHistory'][0].update(date='2026-07-01'), 'outside the covered')]:
    r=copy.deepcopy(request); mutate(r); rejects(name, r, phrase)
r=copy.deepcopy(request); r['startDate']='2026-10-15'; r['posDates'].append('2026-10-14'); rejects('Partial-day exclusion independent of forecast cutoff',r,'partial or future')
r=copy.deepcopy(request); r['posHistory'][0]['sourceUnit']='g'
h,_,n=build_pos_history(r,catalog,bridge.conversion)
check('Incompatible POS units excluded',not h.material_id.eq(base['id']).any(), next(x for x in n if 'Incompatible units' in x))
started=time.perf_counter()
with (ROOT / 'training.log').open('w') as log, contextlib.redirect_stdout(log), contextlib.redirect_stderr(log), warnings.catch_warnings(record=True) as captured:
    warnings.simplefilter('always')
    result=bridge.generate(request)
elapsed=time.perf_counter()-started
(ROOT / 'result.json').write_text(json.dumps(result,indent=2,allow_nan=False))
valid=result['series'][0]
check('Actual full SARIMA grid training',len(result['series'])==1 and valid['materialId']==base['id'],'No model mocks; original parameter grid and rolling validation')
check('Seven calendar forecast days including weekend',len(valid['points'])==7 and valid['points'][0]['date']=='2026-10-14' and valid['points'][-1]['date']=='2026-10-20','2026-10-14 through 2026-10-20')
check('Finite ordered prediction intervals',all(np.isfinite([p['lower95'],p['forecast'],p['upper95']]).all() and 0<=p['lower95']<=p['forecast']<=p['upper95'] for p in valid['points']),'All seven dates checked')
check('Constant unused enrolled material skipped',any('constant history' in n for n in result['warnings']),'No replacement forecasting model used')
check('POS-only training provenance',valid['metadata']['audit']['posDays']==90 and valid['metadata']['audit']['csvDays']==0,str(valid['metadata']['audit']))
summary={'environment': {'python':sys.version,'executable':sys.executable,'isolated_source':str(ROOT/'source'),'dependencies':'virtualenv with read-only shared installed packages; no production database', 'numpy':np.__version__,'pandas':pd.__version__},
 'fixture':'Synthetic completed POS ledger snapshots, real local catalog identities; not live sales', 'durationSeconds':round(elapsed,2),
 'checks':checks,'passed':sum(c['passed'] for c in checks),'total':len(checks),
 'material':valid['name'],'unit':valid['unit'],'forecastTotal':round(sum(p['forecast'] for p in valid['points']),2),
 'order':valid['metadata']['order'],'seasonalOrder':valid['metadata']['seasonalOrder'],'metrics':valid['metadata']['metrics'],
 'convergenceWarnings':sum('converg' in str(w.message).lower() for w in captured),'warnings':result['warnings']}
(ROOT / 'summary.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
if not all(c['passed'] for c in checks): sys.exit(1)
