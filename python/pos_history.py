"""Merge authoritative POS consumption with compatible CSV history by material/date."""
import pandas as pd
import numpy as np
import holidays


def merge_pos_history(history, request, match_material, conversion):
    notes, frames, policies = [], [], {}
    materials = {item['id']: item for item in request['materials']}
    for (name, unit), group in history.groupby(['raw_material', 'unit']):
        try:
            material = match_material(group, request['materials'])
            factor = conversion(unit, material['unit'])
            frame = group.copy()
            frame['quantity_used'] *= factor
            frame['unit'] = material['unit']
            frame['raw_material'] = material['name']
            frame['item_code'] = material['sku']
            frame['material_id'] = material['id']
            frames.append(frame)
            policies[material['id']] = {'name': name, 'unit': unit, 'factor': factor}
        except ValueError as exc:
            notes.append(f'{name} ({unit}): CSV history excluded: {exc}')
    combined = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=[*history.columns, 'material_id'])
    pos_dates = sorted({pd.Timestamp(date).normalize() for date in request.get('posDates', [])})
    pos = request.get('posHistory', [])
    if not pos_dates:
        notes.append('No eligible POS transaction dates yet; using compatible CSV history.')
        return combined, policies, notes
    # Every CSV ingredient on a POS-covered date is removed, including days later refunded.
    combined = combined[~combined['date'].isin(pos_dates)].copy()
    historical_ids = {frame['material_id'].iloc[0] for frame in frames}
    actual = {}
    for row in pos:
        if row['materialId'] not in materials:
            continue
        qty = float(row['quantity'])
        if not np.isfinite(qty) or qty < 0:
            raise ValueError('Invalid POS consumption quantity')
        day = pd.Timestamp(row['date']).normalize()
        if day not in pos_dates:
            raise ValueError('POS consumption date is outside the coverage snapshot')
        key = (row['materialId'], day)
        actual[key] = actual.get(key, 0) + qty
    live_ids = {key[0] for key in actual}
    calendar = holidays.country_holidays('PH', years=sorted({day.year for day in pos_dates}))
    records = []
    for material_id in historical_ids | live_ids:
        material = materials[material_id]
        first = min(day for key_id, day in actual if key_id == material_id) if material_id in live_ids else pos_dates[0]
        for day in pos_dates:
            if material_id not in historical_ids and day < first:
                continue
            records.append({'date': day, 'product': 'POS sales', 'raw_material': material['name'],
                'item_code': material['sku'], 'unit': material['unit'], 'material_id': material_id,
                'quantity_used': actual.get((material_id, day), 0),
                'holiday': 'YES' if day.date() in calendar else 'NO'})
    combined = pd.concat([combined, pd.DataFrame(records)], ignore_index=True)
    notes.append(f'Included {len(pos)} POS material/day totals across {len(pos_dates)} transaction dates through {pos_dates[-1].date()}. POS replaces CSV history on those dates; voided/refunded sales are excluded.')
    if request.get('capturedAt') and pos_dates[-1] == pd.Timestamp(request['capturedAt']).tz_convert('Asia/Manila').tz_localize(None).normalize():
        notes.append('Today\'s POS history is a partial-day snapshot. Generate again after closing for a complete daily total.')
    return combined, policies, notes
