"""Trusted local model artifacts; corrupt/stale caches never stop forecasting."""
import hashlib
import json
import os
import pickle
import platform
import uuid
from pathlib import Path
import statsmodels
import pandas as pd

HERE = Path(__file__).resolve().parent


def fingerprint():
    names = ['model_store.py', 'operational_forecast.py', 'operational_history.py',
             'constrained_sarima.py', 'interval_calibration.py', 'SARIMA.py', 'demand_portfolio.py', 'inventory_policy.py', 'forecast_signals.py']
    payload = b''.join((HERE / name).read_bytes() for name in names)
    from forecast_signals import source
    if source().exists():
        payload += source().read_bytes()
    return hashlib.sha256(payload + platform.python_version().encode() + statsmodels.__version__.encode()).hexdigest()


def directory():
    value = os.environ.get('FORECAST_MODEL_CACHE_DIR')
    return Path(value).resolve() if value else HERE / 'trained_models'


def key(material_id, unit):
    return hashlib.sha256(f'POS-only:{material_id}:{unit.lower()}'.encode()).hexdigest()


def load(material_id, unit):
    folder = directory()
    try:
        meta = json.loads((folder / (key(material_id, unit) + '.json')).read_text())
        if meta.get('fingerprint') != fingerprint():
            return None
        path = (folder / meta['file']).resolve()
        if not path.is_relative_to(folder.resolve()) or path.suffix != '.pkl':
            return None
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != meta['sha256']:
            return None
        # Only internally produced, hash-checked local artifacts are loaded.
        bundle = pickle.loads(data)
        if bundle.get('source') != 'POS-only' or bundle.get('unit') != unit:
            return None
        return bundle
    except (OSError, ValueError, KeyError, EOFError, pickle.UnpicklingError, AttributeError, ImportError):
        return None


def save(material_id, unit, bundle):
    folder = directory()
    token = key(material_id, unit)
    try:
        # Historical replay must not roll a newer operational artifact backward.
        previous = load(material_id, unit)
        if previous is not None and previous['history'].Date.max() > bundle['history'].Date.max():
            return False
        folder.mkdir(parents=True, exist_ok=True)
        filename = token + '.' + uuid.uuid4().hex + '.pkl'
        data = pickle.dumps({**bundle, 'source': 'POS-only', 'unit': unit}, protocol=pickle.HIGHEST_PROTOCOL)
        (folder / filename).write_bytes(data)
        meta = {'fingerprint': fingerprint(), 'file': filename,
                'sha256': hashlib.sha256(data).hexdigest(),
                'trainedThrough': str(bundle['history'].Date.max().date())}
        temporary = folder / (token + '.' + uuid.uuid4().hex + '.tmp')
        temporary.write_text(json.dumps(meta))
        temporary.replace(folder / (token + '.json'))
        return True
    except (OSError, pickle.PicklingError, TypeError):
        return False


def same_prefix(previous, current):
    if len(previous) > len(current):
        return False
    columns = ['Date', 'qty', 'is_holiday']
    if 'is_observed' in previous or 'is_observed' in current:
        if 'is_observed' not in previous or 'is_observed' not in current:
            return False
        columns.append('is_observed')
    return previous[columns].reset_index(drop=True).equals(current.iloc[:len(previous)][columns].reset_index(drop=True))
