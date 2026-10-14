import unittest
from unittest.mock import patch
import pandas as pd
import numpy as np
import SARIMA
from forecast_bridge import generate, conversion, forecast_calendar_days, select_stable_forecast

class SarimaPosTests(unittest.TestCase):
    def test_completed_pos_drives_existing_sarima_functions(self):
        dates = pd.date_range('2026-07-01', periods=70)
        catalog = pd.DataFrame([{'record_type': 'RAW_MATERIAL', 'sku': 'MILK', 'unit_code': 'ml'}])
        request = {'startDate': '2026-09-09', 'capturedAt': '2026-09-09T05:00:00Z',
            'materials': [{'id': 'milk', 'sku': 'MILK', 'name': 'Milk', 'unit': 'ml', 'currentStock': 500}],
            'posDates': [str(d.date()) for d in dates],
            'posHistory': [{'materialId': 'milk', 'date': str(d.date()), 'sourceUnit': 'l', 'quantity': 1 + i % 7 / 10} for i, d in enumerate(dates)]}
        policy = pd.DataFrame(columns=['ItemCode', 'Unit', 'SafetyStock', 'LeadTime', 'CatalogReorderPoint'])
        training = {'order': (0, 1, 0), 'seasonal': (0, 0, 0, 7), 'exog_cols': ['is_holiday'],
            'metrics': {'mae': 1., 'rmse': 1., 'mape': 1., 'smape': 1., 'aic': 1., 'bic': 1.}}
        future = pd.DataFrame({'Date': pd.date_range('2026-09-09', periods=7), 'Forecast': 1200., 'Lower95': 900., 'Upper95': 1500.})
        with patch.dict(SARIMA.CONFIG, {}, clear=False), patch('forecast_bridge.load_catalog', return_value=catalog), patch('forecast_bridge.inventory_reference', return_value=policy), patch.object(SARIMA, 'train_sarima', return_value=training) as train, patch.object(SARIMA, 'fit_full_model'), patch.object(SARIMA, 'forecast_future', return_value=future):
            result = generate(request)
            series = train.call_args.args[0]['series']
            self.assertEqual(len(series), 70)
            self.assertEqual(series.qty.iloc[0], 1000)
            self.assertTrue((series.Date.dt.dayofweek >= 5).any())
            self.assertEqual(result['series'][0]['metadata']['model'], 'SARIMA')
            self.assertEqual(result['series'][0]['metadata']['trainingSource'], 'POS-only')
            self.assertEqual(len(result['series'][0]['points']), 7)

    def test_no_pos_does_not_use_csv(self):
        with patch('forecast_bridge.load_catalog', return_value=pd.DataFrame()):
            with self.assertRaisesRegex(ValueError, 'No complete POS days'):
                generate({'startDate': '2026-10-14', 'materials': []})

    def test_calendar_forecast_includes_weekends(self):
        self.assertEqual(len(forecast_calendar_days('2026-10-14')), 7)
        self.assertEqual(conversion('l', 'ml'), 1000)

    def test_rejects_nonfinite_model_interval(self):
        dates = pd.date_range('2026-10-14', periods=1)
        future = pd.DataFrame({'Date': dates, 'Forecast': [1.], 'Lower95': [0.], 'Upper95': [np.inf]})
        with patch.object(SARIMA, 'fit_full_model'), patch.object(SARIMA, 'forecast_future', return_value=future):
            with self.assertRaisesRegex(ValueError, 'No validated SARIMA'):
                select_stable_forecast({'series': pd.DataFrame({'qty': [10.]})}, {'exog_cols': [], 'order': (0,1,0), 'seasonal': (0,0,0,7)}, 1, dates)

if __name__ == '__main__':
    unittest.main()
