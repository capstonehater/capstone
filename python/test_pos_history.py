import unittest
import pandas as pd
from pos_history import merge_pos_history
from forecast_bridge import match_material, conversion


class PosHistoryTests(unittest.TestCase):
    def setUp(self):
        self.material = {'id': 'milk', 'name': 'Milk', 'sku': 'RM-MILK', 'unit': 'ML'}
        self.history = pd.DataFrame([
            {'date': pd.Timestamp(date), 'product': 'Latte', 'raw_material': 'Milk',
             'unit': 'L', 'item_code': 'RM-MILK', 'quantity_used': 2, 'holiday': 'NO'}
            for date in ['2026-09-03', '2026-09-04']
        ])

    def merge(self, pos, dates, materials=None):
        return merge_pos_history(self.history, {'materials': materials or [self.material],
            'posHistory': pos, 'posDates': dates}, match_material, conversion)

    def test_pos_replaces_overlapping_csv_and_preserves_older_history(self):
        result, policies, _ = self.merge([{'materialId': 'milk', 'date': '2026-09-04', 'quantity': 350}], ['2026-09-04'])
        daily = result.groupby('date')['quantity_used'].sum()
        self.assertEqual(daily.loc['2026-09-03'], 2000)
        self.assertEqual(daily.loc['2026-09-04'], 350)
        self.assertEqual(policies['milk']['factor'], 1000)

    def test_reversed_order_date_does_not_restore_csv_consumption(self):
        result, _, _ = self.merge([], ['2026-09-04'])
        self.assertEqual(result.loc[result['date'] == '2026-09-04', 'quantity_used'].sum(), 0)

    def test_batch_allocations_add_once_and_weekend_sales_survive(self):
        result, _, _ = self.merge([
            {'materialId': 'milk', 'date': '2026-09-05', 'quantity': 100},
            {'materialId': 'milk', 'date': '2026-09-05', 'quantity': 40},
        ], ['2026-09-05'])
        self.assertEqual(result.loc[result['date'] == '2026-09-05', 'quantity_used'].sum(), 140)

    def test_new_pos_only_material_keeps_its_live_unit(self):
        item = {'id': 'new', 'name': 'New ingredient', 'sku': 'NEW', 'unit': 'G'}
        result, policies, _ = self.merge([{'materialId': 'new', 'date': '2026-09-05', 'quantity': 10}], ['2026-09-05'], [self.material, item])
        row = result[result['material_id'] == 'new'].iloc[0]
        self.assertEqual(row['unit'], 'G')
        self.assertEqual(row['quantity_used'], 10)
        self.assertNotIn('new', policies)

    def test_log_transform_handles_zero_days_and_negative_lower_bounds(self):
        import SARIMA
        import numpy as np
        from scipy.special import inv_boxcox
        previous = SARIMA.CONFIG.get('BOXCOX_LAMBDA')
        try:
            SARIMA.CONFIG['BOXCOX_LAMBDA'] = 0
            result = SARIMA.make_stationary(pd.DataFrame({'qty': [0, 100, 0, 200]}))
            self.assertEqual(result['lambda'], 0)
            self.assertTrue(np.isfinite(result['series']['qty_boxcox']).all())
            self.assertTrue(np.isfinite(inv_boxcox(np.array([-10, 0, 10]), result['lambda'])).all())
        finally:
            if previous is None:
                SARIMA.CONFIG.pop('BOXCOX_LAMBDA', None)
            else:
                SARIMA.CONFIG['BOXCOX_LAMBDA'] = previous

    def test_invalid_pos_quantity_is_rejected(self):
        with self.assertRaises(ValueError):
            self.merge([{'materialId': 'milk', 'date': '2026-09-04', 'quantity': -1}], ['2026-09-04'])


if __name__ == '__main__':
    unittest.main()
