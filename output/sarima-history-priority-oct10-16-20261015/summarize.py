import json,csv,math
from pathlib import Path
ROOT=Path(__file__).resolve().parent
request=json.loads((ROOT/'input.json').read_text())
rows=[json.loads(p.read_text()) for p in (ROOT/'materials').glob('*.json')]
rows.sort(key=lambda r:r['name'])
expected=[f'2026-10-{d:02d}' for d in range(10,17)]
for r in rows:
 if r['status']=='forecasted':
  assert r['series']['metadata']['model']=='SARIMA'
  assert [p['date'] for p in r['series']['points']]==expected
  assert all(math.isfinite(p['forecast']) and p['forecast']>=0 for p in r['series']['points'])
with (ROOT/'daily-results.csv').open('w',newline='',encoding='utf-8-sig') as f:
 writer=csv.writer(f); writer.writerow(['Material','Unit',*expected,'7-day total','Validation MAPE','Status','Reason'])
 for r in rows:
  points=r.get('series',{}).get('points',[]); writer.writerow([r['name'],r['unit'],*[round(p['forecast'],2) for p in points],*(['']*(7-len(points))),r.get('total',''),r.get('metrics',{}).get('mape'),r['status'],r.get('reason','')])
lines=['Period: October 10-16, 2026. SARIMA only, forced retraining.','History: 2024-2026 positive daily consumption has priority; POS fills zero/absent material/day totals. No forecast-period data used.','','| Material | Unit | Seven-day total | Validation MAPE |','|---|---|---:|---:|']
for r in rows:
 if r['status']=='forecasted':
  m=r['metrics'].get('mape'); lines.append(f"| {r['name']} | {r['unit']} | {r['total']:,.2f} | {m:.2f}% |" if m is not None else f"| {r['name']} | {r['unit']} | {r['total']:,.2f} | N/A |")
lines+=['','Excluded:']+[r['name']+': '+r.get('reason','') for r in rows if r['status']!='forecasted']
(ROOT/'RESULTS.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'completed':len(rows),'forecasted':sum(r['status']=='forecasted' for r in rows),'excluded':sum(r['status']!='forecasted' for r in rows)}))
