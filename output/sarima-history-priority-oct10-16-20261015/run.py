import os
os.environ.update(OMP_NUM_THREADS='1', OPENBLAS_NUM_THREADS='1', MKL_NUM_THREADS='1')
os.environ.update(FORECAST_PORTFOLIO='off', FORECAST_TRAINING_SOURCE='mixed', FORECAST_FORCE_FULL_RETRAIN='1', FORECAST_DISABLE_MODEL_CACHE='1')
import sys, json, time, contextlib, warnings
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
ROOT=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT/'source'))

def work(payload):
    import forecast_bridge as bridge
    bridge.SARIMA.CONFIG['DATASET'] = str((ROOT/'history-by-material'/f"{payload[1]['id']}.csv").resolve())
    request,material=payload
    request={**request,'materials':[material],'posHistory':[r for r in request['posHistory'] if r['materialId']==material['id']]}
    saved = ROOT/'materials'/f"{material['id']}.json"
    if saved.exists(): return json.loads(saved.read_text())
    began=time.perf_counter()
    result={'materialId':material['id'],'name':material['name'],'sku':material['sku'],'unit':material['unit']}
    with (ROOT/'logs'/f"{material['id']}.log").open('w',encoding='utf-8') as log, contextlib.redirect_stdout(log), contextlib.redirect_stderr(log), warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        try:
            output=bridge.generate(request)
            series=output['series'][0]
            if series['metadata']['model'] != 'SARIMA':
                raise ValueError('Excluded non-SARIMA model: ' + series['metadata']['model'])
            result.update(status='forecasted',total=round(sum(p['forecast'] for p in series['points']),2),metrics=series['metadata']['metrics'],series=series,warnings=output['warnings'])
        except Exception as exc:
            result.update(status='excluded',reason=str(exc))
        result['convergenceWarnings']=sum('converg' in str(w.message).lower() for w in caught)
    result['seconds']=round(time.perf_counter()-began,2)
    (ROOT/'materials'/f"{material['id']}.json").write_text(json.dumps(result,indent=2,allow_nan=False),encoding='utf-8')
    return result

def main():
    request=json.loads((ROOT/'input.json').read_text())
    (ROOT/'logs').mkdir(exist_ok=True); (ROOT/'materials').mkdir(exist_ok=True)
    began=time.perf_counter(); results=[]
    with ProcessPoolExecutor(max_workers=8) as pool:
        jobs=[pool.submit(work,(request,m)) for m in request['materials']]
        for job in as_completed(jobs):
            result=job.result(); results.append(result)
            print(f"{len(results)}/{len(jobs)} {result['status']}: {result['name']}" ,flush=True)
    results.sort(key=lambda r:r['name'])
    summary={'startDate':request['startDate'],'endDate':'2026-10-16','capturedAt':request['capturedAt'],'source':'Actual database snapshot; completed POS usage; read-only run', 'materials':len(results),'forecasted':sum(r['status']=='forecasted' for r in results),'excluded':sum(r['status']=='excluded' for r in results),'seconds':round(time.perf_counter()-began,2),'results':results}
    (ROOT/'results.json').write_text(json.dumps(summary,indent=2,allow_nan=False),encoding='utf-8')
    lines=['# Full enrolled-material SARIMA forecast','',f"Period: October 10-16, 2026. Materials: {len(results)}. Forecasted: {summary['forecasted']}. Excluded: {summary['excluded']}.",'','Source: fresh read-only database snapshot, 2024-2026 CSV priority with POS only for zero/absent consumption, isolated copied application code and virtualenv. Original SARIMA grid and rolling validation; no model mocks or substitute models. Current partial Philippine day excluded. No forecast runs were written to the database.','','| Material | Unit | Status | 7-day total | Validation MAPE | Reason |','|---|---|---|---:|---:|---|']
    for r in results:
        mape=r.get('metrics',{}).get('mape'); reason=r.get('reason','').replace('|','/').replace('\n',' ')
        lines.append(f"| {r['name']} | {r['unit']} | {r['status']} | {r.get('total','?')} | {round(mape,2) if mape is not None else '?'} | {reason} |")
    lines+=['','Validation MAPE is rolling historical validation, not future forecast accuracy. Model prediction intervals have not been independently calibrated. Convergence warnings are recorded per material; finite forecasts alone do not establish optimizer convergence.','',f"Total convergence warnings: {sum(r['convergenceWarnings'] for r in results)}."]
    (ROOT/'REPORT.md').write_text('\n'.join(lines),encoding='utf-8')
    print(json.dumps({k:v for k,v in summary.items() if k!='results'}),flush=True)
if __name__=='__main__': main()
