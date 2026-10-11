"""Run project unit tests with live terminal output and persistent error logs."""
import datetime
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
LOGS = Path(__file__).resolve().parent / 'results' / datetime.datetime.now().strftime('%Y%m%d-%H%M%S')


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--suite', choices=['frontend', 'backend', 'forecasting', 'store-recommendation', 'release-packaging'], help='Run only this suite (default: all).')
    args = parser.parse_args()
    LOGS.mkdir(parents=True, exist_ok=True)
    node = shutil.which('node') or 'node'
    suites = [
        ('frontend', ROOT / 'ims-frontend', [node, '--test', *[str(p) for p in sorted((ROOT / 'ims-frontend/tests').glob('*.test.cjs'))]]),
        ('backend', ROOT / 'ims-backend', [node, 'node_modules/jest/bin/jest.js', '--runInBand', '--ci']),
        ('forecasting', ROOT / 'python', [sys.executable, '-m', 'unittest', 'discover', '-s', '.', '-p', 'test_*.py', '-v']),
        ('store-recommendation', ROOT / 'AI-Store Reco', [sys.executable, '-m', 'unittest', 'discover', '-s', '.', '-p', 'test_*.py', '-v']),
        ('release-packaging', ROOT, [sys.executable, '-m', 'unittest', 'discover', '-s', 'scripts/tests', '-p', 'test_*.py', '-v']),
    ]
    results = []
    for name, cwd, command in suites:
        if args.suite and name != args.suite:
            continue
        print(f'\n=== {name} ===\nDirectory: {cwd}\nCommand: {subprocess.list2cmdline(command)}', flush=True)
        log = LOGS / f'{name}.log'
        with log.open('w', encoding='utf-8') as output:
            try:
                process = subprocess.Popen(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
                for line in process.stdout:
                    print(line, end='', flush=True)
                    output.write(line)
                    output.flush()
                code = process.wait()
            except OSError as error:
                detail = f'{type(error).__name__}: {error}\n'
                print(detail, end='', flush=True)
                output.write(detail)
                code = 1
        results.append({'suite': name, 'exit_code': code, 'log': str(log.relative_to(ROOT))})
        print(f'{name}: {"PASS" if code == 0 else "FAIL"} (exit {code})', flush=True)
    (LOGS / 'summary.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print('\n=== Summary ===', flush=True)
    for result in results:
        print(f'{result["suite"]}: {"PASS" if result["exit_code"] == 0 else "FAIL"} | {result["log"]}', flush=True)
    return int(any(result['exit_code'] for result in results))


if __name__ == '__main__':
    sys.exit(main())
