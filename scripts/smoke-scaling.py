"""Read-only checks for a disposable/staging stack; does not generate a flood."""
import argparse
import json
import time
from urllib.request import Request, urlopen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--url', default='http://127.0.0.1:8080')
parser.add_argument('--min-api-instances', type=int, default=2)
args = parser.parse_args()
instances = set()
for _ in range(16):
    request = Request(args.url.rstrip('/') + '/backend/health', headers={'Cache-Control': 'no-cache'})
    with urlopen(request, timeout=10) as response:
        body = json.load(response)
        if response.status != 200 or body.get('status') != 'ok':
            raise SystemExit('API readiness check failed')
        instances.add(body['instance'])
    time.sleep(0.25)
if len(instances) < args.min_api_instances:
    raise SystemExit(f'Expected {args.min_api_instances} API instances; reached {len(instances)}')
with urlopen(args.url.rstrip('/') + '/', timeout=10) as response:
    if response.status >= 500:
        raise SystemExit('Frontend check failed')
print(f'Scaling smoke check passed: reached {len(instances)} API instances and frontend.')
