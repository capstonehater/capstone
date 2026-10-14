import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import numpy as np
import pandas as pd
from mixed_history import select_csv_period, fill_unknown_days
from pos_history import merge_pos_history
from forecast_bridge import conversion, match_material
import model_store


class MixedHistoryTests(unittest.TestCase):
    def history(self):
        dates = pd.date_range('2024-01-01', '2026-08-31')
        return pd.DataFrame({'date': dates, 'product': 'Latte', 'raw_material': 'Milk',
                             'item_code': 'MILK', 'unit': 'ml', 'quantity_used': 100., 'holiday': 'NO'})

    def test_two_year_base_and_pos_overlap_are_not_double_counted(self):
        source = self.history()
        material = {'id': 'milk', 'name': 'Milk', 'sku': 'MILK', 'unit': 'ml'}
        request = {'startDate': '2026-09-03', 'capturedAt': '2026-09-03T03:00:00Z',
                   'materials': [material], 'posDates': ['2026-08-31', '2026-09-02'],
                   'posHistory': [{'materialId': 'milk', 'date': '2026-08-31', 'quantity': .2, 'sourceUnit': 'l'},
                                  {'materialId': 'milk', 'date': '2026-09-02', 'quantity': 150., 'sourceUnit': 'ml'}]}
        merged, _, _ = merge_pos_history(source, request, match_material, conversion)
        complete, count = fill_unknown_days(merged)
        daily = complete.groupby('date').quantity_used.sum()
        self.assertGreater(len(daily), 730)
        self.assertEqual(daily.loc['2026-08-31'], 200.)
        self.assertEqual(daily.loc['2026-09-02'], 150.)
        self.assertEqual(count, 1)
        missing = complete[complete.date.eq('2026-09-01')].iloc[0]
        self.assertFalse(missing.is_observed)
        self.assertEqual(missing.history_source, 'IMPUTED')
        self.assertEqual(missing.quantity_used, 100.)

    def test_period_excludes_2023_2027_and_forecast_targets(self):
        history = pd.DataFrame({'date': ['2023-12-31', '2024-01-01', '2026-10-12', '2026-10-13', '2027-01-01']})
        result = select_csv_period(history, '2026-10-13')
        self.assertEqual(result.date.dt.strftime('%Y-%m-%d').tolist(), ['2024-01-01', '2026-10-12'])

    def test_partial_pos_day_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'partial'):
            merge_pos_history(self.history(), {'startDate': '2026-09-04', 'capturedAt': '2026-09-03T03:00:00Z',
                              'materials': [], 'posDates': ['2026-09-03']}, match_material, conversion)

    def test_sparse_csv_days_stay_zero_and_do_not_become_imputed_demand(self):
        history = self.history().iloc[:3].copy()
        history.loc[1, ['raw_material', 'item_code']] = ['Other', 'OTHER']
        materials = [{'id': name, 'name': name, 'sku': sku, 'unit': 'ml'}
                     for name, sku in [('Milk', 'MILK'), ('Other', 'OTHER')]]
        merged, _, _ = merge_pos_history(history, {'materials': materials}, match_material, conversion)
        complete, count = fill_unknown_days(merged)
        row = complete[complete.raw_material.eq('Milk') & complete.date.eq('2024-01-02')].iloc[0]
        self.assertEqual(row.quantity_used, 0.)
        self.assertEqual(row.history_source, 'CSV')
        self.assertEqual(count, 0)

    def test_changed_csv_invalidates_mixed_model_cache(self):
        import SARIMA
        with tempfile.TemporaryDirectory() as folder:
            csv = Path(folder) / 'history.csv'
            csv.write_text('old')
            with patch.dict(os.environ, {'FORECAST_TRAINING_SOURCE': 'mixed'}), \
                    patch.dict(SARIMA.CONFIG, {'DATASET': str(csv)}):
                first = model_store.fingerprint()
                csv.write_text('new history')
                self.assertNotEqual(first, model_store.fingerprint())


if __name__ == '__main__':
    unittest.main()
