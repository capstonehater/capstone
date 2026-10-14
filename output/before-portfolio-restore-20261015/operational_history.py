"""Operational daily usage uses covered POS days, never simulated CSV demand."""
import numpy as np
import pandas as pd
import holidays
import os


def build_pos_history(request, catalog, conversion):
    start = pd.Timestamp(request['startDate']).normalize()
    covered = sorted({pd.Timestamp(day).normalize() for day in request.get('posDates', [])})
    if not covered:
        raise ValueError('No complete POS days available. CSV data is development-only; import completed POS history.')
    if any(day >= start for day in covered):
        raise ValueError('POS coverage includes forecast dates; future observations cannot enter training')
    if request.get('capturedAt'):
        capture_day = pd.Timestamp(request['capturedAt']).tz_convert('Asia/Manila').tz_localize(None).normalize()
        if any(day >= capture_day for day in covered):
            raise ValueError('POS coverage includes a partial or future Philippine trading day')
    # Without explicit closure/import coverage, missing store days are unknown.
    first = len(covered) - 1
    while first > 0 and covered[first] - covered[first - 1] == pd.Timedelta(days=1):
        first -= 1
    keep_segment = os.environ.get('FORECAST_GAP_STRATEGY', 'causal') == 'segment'
    dates = covered[first:] if keep_segment else list(pd.date_range(covered[0], covered[-1]))
    retained = set(dates)
    notes = [f'Operational training: {len(covered)} covered POS days through {dates[-1].date()}; generated CSV usage is excluded.']
    if first and keep_segment:
        notes.append(f'POS coverage has gaps. Kept the latest uninterrupted segment; {first} older covered days were excluded rather than filling unknown dates with zeros.')
    missing = set(dates) - set(covered)
    if missing and not keep_segment:
        notes.append(f'{len(missing)} unknown calendar days are causally estimated from earlier covered weekday amounts for model continuity. They are marked IMPUTED, are not POS observations, and are not measured sales.')
    reference = catalog[catalog.record_type.eq('RAW_MATERIAL')].set_index('sku')
    materials = {m['id']: m for m in request['materials']}
    quantities, source_units, invalid = {}, {}, set()
    for row in request.get('posHistory', []):
        if row['materialId'] not in materials:
            continue
        material = materials[row['materialId']]
        day = pd.Timestamp(row['date']).normalize()
        if day not in covered:
            raise ValueError('POS quantity is outside the covered-day snapshot')
        amount = float(row['quantity'])
        if not np.isfinite(amount) or amount < 0:
            raise ValueError('Invalid POS consumption quantity')
        if day not in retained:
            continue
        try:
            if material['sku'] not in reference.index:
                raise ValueError('SKU is absent from the current material catalog')
            source = row.get('sourceUnit') or reference.loc[material['sku'], 'unit_code']
            amount *= conversion(source, material['unit'])
            source_units.setdefault(material['id'], set()).add(source)
            key = (material['id'], day)
            quantities[key] = quantities.get(key, 0.) + amount
        except ValueError as exc:
            invalid.add(material['id'])
            notes.append(f"{material['name']} ({material['unit']}): POS history excluded: {exc}")
    calendar = holidays.country_holidays('PH', years=sorted({day.year for day in dates}))
    records, policies = [], {}
    for material in materials.values():
        if material['id'] in invalid:
            continue
        try:
            if material['sku'] not in reference.index:
                raise ValueError('SKU is absent from the current material catalog')
            source = reference.loc[material['sku'], 'unit_code']
            # Also validate never-used materials: a missing ledger cannot justify
            # treating an incompatible catalog unit as a legitimate zero series.
            conversion(source, material['unit'])
        except ValueError as exc:
            notes.append(f"{material['name']} ({material['unit']}): POS history excluded: {exc}")
            continue
        policies[material['id']] = {'name': material['name'], 'unit': material['unit'], 'factor': 1.}
        prior = []
        for day in dates:
            observed = day in covered
            if observed:
                amount = quantities.get((material['id'], day), 0.)
            else:
                same_day = [qty for date, qty in prior[-56:] if date.dayofweek == day.dayofweek]
                amount = float(np.mean(same_day)) if same_day else float(np.mean([qty for _, qty in prior[-28:]]))
            records.append({'date': day, 'product': 'Completed POS sales', 'raw_material': material['name'],
                'item_code': material['sku'], 'unit': material['unit'], 'material_id': material['id'],
                'quantity_used': amount, 'history_source': 'POS' if observed else 'IMPUTED', 'is_observed': observed,
                'holiday': 'YES' if day.date() in calendar else 'NO'})
            if observed:
                prior.append((day, amount))
    return pd.DataFrame(records), policies, notes
