import json
from concurrent.futures import ProcessPoolExecutor,as_completed
from run import work,ROOT
if __name__ == '__main__':
 request=json.loads((ROOT/'input.json').read_text())
 with ProcessPoolExecutor(max_workers=4) as pool:
  jobs=[pool.submit(work,(request,m)) for m in [m for m in reversed(request['materials']) if not (ROOT/'materials'/f"{m['id']}.json").exists() and not (ROOT/'logs'/f"{m['id']}.log").exists()][:4]]
  for job in as_completed(jobs):
   r=job.result(); print(r['status']+': '+r['name'],flush=True)
