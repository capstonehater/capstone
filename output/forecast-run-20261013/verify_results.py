import json
import math
from datetime import date, timedelta
from pathlib import Path
from collections import Counter
from statistics import median, mean

root = Path(__file__).resolve().parent
data = json.loads((root / 'results.json').read_text(encoding='utf-8'))
request = json.loads((root / 'input.json').read_text(encoding='utf-8'))
expected = {r['id'] for r in request['materials']}
rows = data['materials']
actual = {r.get('materialId', r.get('id')) for r in rows}
assert len(rows) == len(actual) and actual == expected, 'Some material results are missing or duplicated'
dates = [(date.fromisoformat(request['startDate']) + timedelta(days=i)).isoformat() for i in range(7)]
for row in rows:
    if row['status'] == 'failed':
        assert row['reason']
        continue
    assert [p['date'] for p in row['points']] == dates
    assert row['fittingDays'] <= row['availableDays']
    assert date.fromisoformat(row['historyEnd']) < date.fromisoformat(dates[0])
    assert all(math.isfinite(p['forecast']) and p['forecast'] >= 0 for p in row['points'])
    assert math.isclose(sum(p['forecast'] for p in row['points']), row['total'], rel_tol=1e-10, abs_tol=1e-8)
    assert row['cvMAPE'] is None or math.isfinite(row['cvMAPE']) and row['cvMAPE'] >= 0
    for p in row['points']:
        if 'modelLower95' in p:
            assert 0 <= p['modelLower95'] <= p['forecast'] <= p['modelUpper95']
values = [r['cvMAPE'] for r in rows if r.get('cvMAPE') is not None]
summary = {'materials': len(rows), 'statusCounts': dict(Counter(r['status'] for r in rows)),
           'definedSelectionMAPE': len(values), 'medianSelectionMAPE': median(values) if values else None,
           'meanSelectionMAPE': mean(values) if values else None,
           'mapeBelow30Count': sum(v < 30 for v in values),
           'forecastDates': dates, 'verified': True}
(root / 'verification.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary, indent=2))
