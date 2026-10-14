"""Only externally recorded signals known at the forecast origin enter regressors.

IMPROVED: rows that share a date no longer overwrite each other (only fields a
row actually states are written, applied in knownOn order so later revisions
win), and the JSON file is parsed once and cached until it changes.
"""
import json
import os
from pathlib import Path
import numpy as np
import pandas as pd

FIELDS = ('heavyRain', 'typhoon', 'schoolBreak', 'localEvent', 'promotion', 'priceChange', 'closure')
_cache = {}


def source():
    return Path(os.environ.get('FORECAST_EVENT_FILE', str(Path(__file__).resolve().parent / 'forecast_events.json')))


def _rows():
    path = source()
    if not path.exists():
        return []
    stamp = path.stat().st_mtime_ns
    cached = _cache.get(path)
    if cached and cached[0] == stamp:
        return cached[1]
    parsed = []
    for row in json.loads(path.read_text(encoding='utf-8')):
        values = {}
        for field in FIELDS:
            if field in row:
                value = float(row[field])
                if not np.isfinite(value):
                    raise ValueError('Signal values must be finite')
                values[field] = value
        parsed.append((pd.Timestamp(row['knownOn']).normalize(),
                       pd.Timestamp(row['date']).normalize(), values))
    parsed.sort(key=lambda item: item[0])
    _cache[path] = (stamp, parsed)
    return parsed


def features(dates, origin):
    dates = pd.DatetimeIndex(dates)
    origin = pd.Timestamp(origin).normalize()
    result = pd.DataFrame(0.0, index=range(len(dates)), columns=list(FIELDS))
    position = {day: i for i, day in enumerate(dates.normalize())}
    for known, day, values in _rows():
        if known > origin or day not in position:
            continue
        for field, value in values.items():
            result.iat[position[day], result.columns.get_loc(field)] = value
    return result