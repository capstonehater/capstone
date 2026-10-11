"""Only externally recorded signals known at the forecast origin enter regressors."""
import json
import os
from pathlib import Path
import numpy as np
import pandas as pd

FIELDS = ('heavyRain', 'typhoon', 'schoolBreak', 'localEvent', 'promotion', 'priceChange', 'closure')


def source():
    return Path(os.environ.get('FORECAST_EVENT_FILE', str(Path(__file__).resolve().parent / 'forecast_events.json')))


def features(dates, origin):
    dates = pd.DatetimeIndex(dates)
    result = pd.DataFrame({field: np.zeros(len(dates)) for field in FIELDS})
    path = source()
    if not path.exists():
        return result
    rows = json.loads(path.read_text(encoding='utf-8'))
    origin = pd.Timestamp(origin).normalize()
    for row in rows:
        known = pd.Timestamp(row['knownOn']).normalize()
        day = pd.Timestamp(row['date']).normalize()
        if known > origin:
            continue
        for field in FIELDS:
            value = float(row.get(field, 0))
            if not np.isfinite(value):
                raise ValueError('Signal values must be finite')
            result.loc[dates.normalize() == day, field] = value
    return result
