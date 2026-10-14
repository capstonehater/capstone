"""Historical CSV base with completed POS replacements and causal gap handling."""
import numpy as np
import pandas as pd
import holidays


def select_csv_period(history, start, captured_at=None):
    history = history.copy()
    history['date'] = pd.to_datetime(history.date, errors='raise').dt.normalize()
    cutoff = min(pd.Timestamp(start).normalize(), pd.Timestamp('2027-01-01'))
    if captured_at:
        complete_day = pd.Timestamp(captured_at).tz_convert('Asia/Manila').tz_localize(None).normalize()
        cutoff = min(cutoff, complete_day)
    return history[history.date.ge('2024-01-01') & history.date.lt(cutoff)].copy()


def fill_unknown_days(history):
    """Preserve unknown days as imputed, never as observed zero-demand targets."""
    frames = [history]
    count = 0
    for _, group in history.groupby('material_id'):
        daily = group.groupby('date').quantity_used.sum()
        dates = pd.date_range(daily.index.min(), daily.index.max())
        missing = dates.difference(daily.index)
        if missing.empty:
            continue
        sample = group.iloc[0]
        calendar = holidays.country_holidays('PH', years=sorted(set(dates.year)))
        # Only earlier recorded usage can contribute to a gap estimate.
        records = []
        for day in missing:
            prior = daily[daily.index < day].tail(56)
            weekday = prior[prior.index.dayofweek == day.dayofweek]
            amount = float(weekday.mean() if len(weekday) else prior.tail(28).mean())
            if not np.isfinite(amount):
                raise ValueError('No earlier history available to estimate a missing calendar day')
            records.append({'date': day, 'product': 'Unknown day estimate',
                'raw_material': sample.raw_material, 'unit': sample.unit,
                'item_code': sample.item_code, 'material_id': sample.material_id,
                'quantity_used': amount, 'history_source': 'IMPUTED', 'is_observed': False,
                'holiday': 'YES' if day.date() in calendar else 'NO'})
        count += len(records)
        frames.append(pd.DataFrame(records))
    return pd.concat(frames, ignore_index=True), count
