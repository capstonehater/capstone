"""Source-specific model artifacts; corrupt/stale caches never stop forecasting."""
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
_history_hashes = {}


def source_mode():
    return os.environ.get('FORECAST_TRAINING_SOURCE', 'mixed').lower()


def fingerprint():
    names = ['model_store.py', 'operational_forecast.py', 'operational_history.py',
             'constrained_sarima.py', 'interval_calibration.py', 'SARIMA.py', 'demand_portfolio.py', 'inventory_policy.py', 'forecast_signals.py', 'pos_history.py', 'mixed_history.py']
    payload = b''.join((HERE / name).read_bytes() for name in names)
    from catalog_reference import CATALOG_FILE
    payload += CATALOG_FILE.read_bytes()
    payload += source_mode().encode()
    if source_mode() == 'mixed':
        from SARIMA import CONFIG
        path = (HERE / CONFIG['DATASET']).resolve()
        stamp = path.stat()
        token = (str(path), stamp.st_size, stamp.st_mtime_ns)
        if token not in _history_hashes:
            digest = hashlib.sha256()
            with path.open('rb') as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b''):
                    digest.update(chunk)
            _history_hashes.clear()
            _history_hashes[token] = digest.digest()
        payload += _history_hashes[token]
    from forecast_signals import source
    if source().exists():
        payload += source().read_bytes()
    return hashlib.sha256(payload + platform.python_version().encode() + statsmodels.__version__.encode()).hexdigest()


def directory():
    value = os.environ.get('FORECAST_MODEL_CACHE_DIR')
    return Path(value).resolve() if value else HERE / 'trained_models'


def key(material_id, unit):
    return hashlib.sha256(f'{source_mode()}:{material_id}:{unit.lower()}'.encode()).hexdigest()


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
        if bundle.get('source') != source_mode() or bundle.get('unit') != unit:
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
        data = pickle.dumps({**bundle, 'source': source_mode(), 'unit': unit}, protocol=pickle.HIGHEST_PROTOCOL)
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
    if 'history_source' in previous or 'history_source' in current:
        if 'history_source' not in previous or 'history_source' not in current:
            return False
        columns.append('history_source')
    return previous[columns].reset_index(drop=True).equals(current.iloc[:len(previous)][columns].reset_index(drop=True))
