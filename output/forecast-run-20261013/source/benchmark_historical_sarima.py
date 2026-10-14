"""Matched chronological comparison; outputs never replace operational runs."""
import argparse
import json
from pathlib import Path
import numpy as np
import pandas as pd
import constrained_sarima as cs


def evaluate(series, specs, horizon=7, folds=4, cache=None):
    cache = {} if cache is None else cache
    candidates = []
    for spec in specs:
        key = json.dumps(spec, sort_keys=True)
        if key in cache:
            if cache[key] is not None:
                candidates.append(cache[key])
            continue
        records = []
        for end in range(len(series) - (folds - 1) * horizon, len(series) + 1, horizon):
            train, test = series.iloc[:end-horizon], series.iloc[end-horizon:end]
            try:
                model = cs.fit(train, spec)
                values = cs.predict(model, test.Date, test.is_holiday, interval=True)
                records.append({**cs.metrics(test.qty, values[:, 0]), 'aic': model.aic,
                                'bic': model.bic, 'test': test, 'predictions': values[:, 0]})
            except (ValueError, np.linalg.LinAlgError):
                break
        cache[key] = cs.aggregate_candidate(spec, records, records) if len(records) == folds else None
        if cache[key] is not None:
            candidates.append(cache[key])
    ranked = cs.rank_candidates(candidates, volume_estimation=True, error_tolerance=.03)[0]
    for candidate in ranked:
        try:
            return candidate, cs.fit(series, candidate)
        except (ValueError, np.linalg.LinAlgError):
            continue
    raise ValueError('No candidate survived refit')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--materials', nargs='+', default=[])
    parser.add_argument('--output', default='historical_sarima_benchmark.csv')
    args = parser.parse_args()
    raw = pd.read_csv(Path(__file__).with_name('historical-raw-material-data.csv'),
                      usecols=['date', 'raw_material', 'unit', 'quantity_used', 'holiday'])
    raw['Date'] = pd.to_datetime(raw.date)
    calendar = raw.groupby('Date').holiday.apply(lambda x: x.eq('YES').any()).astype(int)
    daily = raw.groupby(['raw_material', 'unit', 'Date']).quantity_used.sum()
    legacy = cs.historical_candidate_specs()
    current = [s for s in cs.candidate_specs() if s not in legacy]
    rows = []
    for name, unit in daily.index.droplevel('Date').unique():
        if args.materials and not any(token.lower() in name.lower() for token in args.materials):
            continue
        amounts = daily.loc[(name, unit)]
        dates = pd.date_range(amounts.index.min(), calendar.index.max())
        series = pd.DataFrame({'Date': dates, 'qty': amounts.reindex(dates, fill_value=0).to_numpy(),
                               'is_holiday': calendar.reindex(dates, fill_value=0).to_numpy()})
        # Freeze all choices before two untouched final weeks.
        training, test = series.iloc[:-14], series.iloc[-14:]
        row = {'material': name, 'unit': unit, 'selection_end': str(training.Date.max().date()),
               'test_start': str(test.Date.min().date()), 'test_end': str(test.Date.max().date())}
        cache = {}
        for label, specs in [('current', current), ('historical_baseline', legacy), ('revised', current + legacy)]:
            try:
                candidate, model = evaluate(training, specs, cache=cache)
                pred = cs.predict(model, test.Date, test.is_holiday, interval=True)[:, 0]
                row.update({f'{label}_{key}': value for key, value in cs.metrics(test.qty, pred).items()})
                row[f'{label}_spec'] = json.dumps({k: candidate[k] for k in specs[0]})
            except ValueError as exc:
                row[f'{label}_error'] = str(exc)
        rows.append(row)
        pd.DataFrame(rows).to_csv(args.output, index=False)
        print(name, {k: round(v, 2) for k, v in row.items() if k.endswith('_mape')}, flush=True)


if __name__ == '__main__':
    main()
