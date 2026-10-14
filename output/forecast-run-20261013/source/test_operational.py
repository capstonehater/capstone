import os
import tempfile
import unittest
from unittest.mock import patch
import numpy as np
import pandas as pd
from operational_history import build_pos_history
from forecast_bridge import conversion, generate
from operational_forecast import constant_baseline
import model_store


class OperationalTests(unittest.TestCase):
    def setUp(self):
        self.catalog = pd.DataFrame([{'record_type': 'RAW_MATERIAL', 'sku': 'S', 'name': 'Milk', 'unit_code': 'ml'}])
        self.request = {'startDate': '2026-01-10', 'materials': [{'id': 'm', 'sku': 'S', 'name': 'Milk', 'unit': 'ml'}],
            'posDates': ['2026-01-01', '2026-01-07', '2026-01-08', '2026-01-09'],
            'posHistory': [{'materialId': 'm', 'date': '2026-01-08', 'quantity': 2, 'sourceUnit': 'l'}]}

    def test_unknown_gaps_are_not_zero_filled(self):
        with patch.dict(os.environ, {'FORECAST_GAP_STRATEGY': 'segment'}):
            history, _, notes = build_pos_history(self.request, self.catalog, conversion)
        self.assertEqual(history.quantity_used.tolist(), [0, 2000, 0])
        self.assertEqual(len(history), 3)
        self.assertTrue(any('gaps' in n for n in notes))

    def test_future_consumption_rejected(self):
        self.request['posDates'].append('2026-01-10')
        with self.assertRaisesRegex(ValueError, 'future'):
            build_pos_history(self.request, self.catalog, conversion)

    def test_causal_gaps_are_marked_and_do_not_use_later_usage(self):
        history, _, _ = build_pos_history(self.request, self.catalog, conversion)
        estimated = history[history.history_source == 'IMPUTED']
        self.assertEqual(len(estimated), 5)
        self.assertTrue((estimated.quantity_used == 0).all())
        self.assertFalse(estimated.is_observed.any())
        self.assertEqual(int(history.is_observed.sum()), 4)
        self.assertEqual(history.iloc[-2].quantity_used, 2000)

    def test_incompatible_recorded_unit_excludes_material(self):
        self.request['posHistory'][0]['sourceUnit'] = 'g'
        history, _, notes = build_pos_history(self.request, self.catalog, conversion)
        self.assertTrue(history.empty)
        self.assertTrue(any('Incompatible' in n for n in notes))

    def test_zero_usage_has_no_percentage_accuracy_claim(self):
        series = pd.DataFrame({'Date': pd.date_range('2025-01-01', periods=365),
            'qty': np.zeros(365), 'is_holiday': np.zeros(365)})
        training, result = constant_baseline(series, 7, pd.date_range('2026-01-01', periods=7))
        self.assertTrue(np.isnan(training['metrics']['mape']))
        self.assertFalse(training['interval_calibration']['coverageGuarantee'])
        self.assertEqual(len(result), 7)
        self.assertEqual(result.Forecast.sum(), 0)

    def test_cache_corruption_and_history_revisions(self):
        history = pd.DataFrame({'Date': pd.date_range('2026-01-01', periods=3), 'qty': [1., 2., 3.], 'is_holiday': [0, 0, 0]})
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'FORECAST_MODEL_CACHE_DIR': folder}):
            self.assertTrue(model_store.save('m', 'ml', {'history': history}))
            cached = model_store.load('m', 'ml')
            self.assertTrue(model_store.same_prefix(cached['history'], history))
            revised = history.copy()
            revised.loc[0, 'qty'] = 8
            self.assertFalse(model_store.same_prefix(cached['history'], revised))
            from pathlib import Path
            next(Path(folder).glob('*.pkl')).write_bytes(b'corrupt')
            self.assertIsNone(model_store.load('m', 'ml'))

    def test_operational_does_not_fall_back_to_csv(self):
        with patch.dict(os.environ, {'FORECAST_TRAINING_SOURCE': 'pos'}), patch('forecast_bridge.load_catalog', return_value=self.catalog), patch('forecast_bridge.pd.read_csv') as csv:
            with self.assertRaisesRegex(ValueError, 'No complete POS'):
                generate({'startDate': '2026-01-10', 'materials': []})
            csv.assert_not_called()

    def test_read_only_cache_does_not_stop_forecasting(self):
        history = pd.DataFrame({'Date': pd.date_range('2026-01-01', periods=3), 'qty': [1., 2., 3.], 'is_holiday': [0, 0, 0]})
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'FORECAST_MODEL_CACHE_DIR': folder}), patch('model_store.Path.mkdir', side_effect=PermissionError('read only')):
            self.assertFalse(model_store.save('m', 'ml', {'history': history}))
