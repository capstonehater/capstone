import unittest
import os
from unittest.mock import patch
import numpy as np
import pandas as pd
from demand_portfolio import classify, intermittent, point_forecast, scaled_metrics, finite_quantile, run
from inventory_policy import recommend


class PortfolioTests(unittest.TestCase):
    def test_previous_sarima_search_survives_a_historical_challenger_regression(self):
        series = self.series(np.arange(1., 365.))
        dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=7)
        reference = {'window': 182, 'transform': 'raw', 'features': 'level',
                     'order': (1, 0, 0), 'seasonal': (1, 0, 0, 7), 'trend': 'c'}
        selected = {**reference, 'window': None, 'historical_search_reference': reference}
        def forecasts(history, method, horizon, spec=None):
            future = history.qty.iloc[-1] + np.arange(1., horizon + 1.)
            if method == 'sarima_reference':
                return future
            if method == 'sarima':
                # Challenger ties the reference during selection but fails later.
                return future if len(history) < 189 else future * 2
            return np.repeat(history.qty.iloc[-1], horizon)
        with patch('SARIMA.train_sarima', return_value=selected), \
                patch('demand_portfolio.point_forecast', side_effect=forecasts):
            training, future = run(series, 7, dates)
        report = training['portfolio']
        self.assertEqual(report['bestBaseline'], 'sarima_reference')
        self.assertFalse(report['promotionPassed'])
        self.assertEqual(report['selectedMethod'], 'sarima')
        self.assertEqual(report['sarimaSearchSource'], 'previous_search')
        self.assertEqual(training['window'], 182)
        self.assertEqual(future.Forecast.tolist(), list(np.arange(365., 372.)))

    def test_reference_forecasts_use_the_preserved_configuration(self):
        reference = {'window': 182}
        with patch('demand_portfolio.fit') as fitted, \
                patch('demand_portfolio.predict', return_value=np.ones(7)):
            point_forecast(self.series(np.arange(1., 70.)), 'sarima_reference', 7,
                           {'window': None, '_reference': reference})
        self.assertEqual(fitted.call_args.args[1], reference)

    def test_portfolio_discovery_does_not_duplicate_interval_testing(self):
        import SARIMA
        series = self.series(np.arange(1., 365.))
        dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=7)
        previous = SARIMA.CONFIG['INTERVAL_VALIDATION_FOLDS']
        def discover(stationary):
            self.assertEqual(SARIMA.CONFIG['INTERVAL_VALIDATION_FOLDS'], 0)
            raise ValueError('No candidate')
        with patch('SARIMA.train_sarima', side_effect=discover):
            training, _ = run(series, 7, dates)
        self.assertEqual(SARIMA.CONFIG['INTERVAL_VALIDATION_FOLDS'], previous)
        self.assertEqual(len(training['portfolio']['outerEvaluation']), 5)

    def series(self, y):
        return pd.DataFrame({'Date': pd.date_range('2025-01-01', periods=len(y)), 'qty': y, 'is_holiday': np.zeros(len(y))})

    def test_demand_classes_and_constant_zero(self):
        self.assertEqual(classify(np.zeros(30))['class'], 'constant_zero')
        self.assertEqual(classify(np.repeat(2, 30))['class'], 'constant')
        self.assertEqual(classify([0, 0, 2] * 10)['class'], 'intermittent')
        self.assertEqual(classify([0, 1, 0, 20] * 10)['class'], 'lumpy')

    def test_tsb_decays_during_observed_no_demand(self):
        self.assertLess(intermittent([3] * 20 + [0] * 30, 'tsb'), intermittent([3] * 20, 'tsb'))
        self.assertEqual(intermittent([0] * 20, 'sba'), 0)

    def test_weekday_forecasts_keep_calendar_alignment(self):
        series = self.series(np.tile(np.arange(1, 8), 4))
        self.assertEqual(point_forecast(series, 'weekday_average_4w', 10).tolist(), [1, 2, 3, 4, 5, 6, 7, 1, 2, 3])

    def test_undefined_scaled_errors_are_null(self):
        errors = scaled_metrics([0, 0], [1, 1], np.zeros(40))
        self.assertIsNone(errors['wape'])
        self.assertIsNone(errors['mase'])
        self.assertEqual(errors['bias'], 1)

    def test_small_quantile_sample_does_not_claim_support(self):
        self.assertFalse(finite_quantile(np.arange(12), .95)[1])
        self.assertTrue(finite_quantile(np.arange(20), .95)[1])

    def test_lead_time_policy_uses_joint_paths_and_pack_size(self):
        paths = np.repeat([[2.] * 7], 20, axis=0)
        base = {'CurrentStock': 3, 'HasInventoryData': True, 'SafetyStock': 0, 'ReorderPoint': 0, 'ForecastTotal': 14, 'Unit': 'g'}
        result = recommend(base, paths, {'leadTimeDays': 2, 'reviewPeriodDays': 3, 'serviceLevel': .95, 'packSize': 4})
        self.assertEqual(result['quantilePolicy']['targetDemand'], 10)
        self.assertEqual(result['RecommendedPurchase'], 8)
        self.assertEqual(recommend(base, paths, {'leadTimeDays': 5, 'reviewPeriodDays': 7})['quantilePolicy']['status'], 'horizon_too_short')

    def test_shelf_life_pack_conflict_requires_review(self):
        base = {'CurrentStock': 0, 'HasInventoryData': True, 'SafetyStock': 0, 'ReorderPoint': 0, 'ForecastTotal': 14, 'Unit': 'g'}
        result = recommend(base, np.repeat([[2.] * 7], 20, axis=0), {'shelfLifeDays': 1, 'packSize': 5})
        self.assertEqual(result['RecommendedPurchase'], 0)
        self.assertTrue(result['quantilePolicy']['manualReviewRequired'])

    def test_selection_calibration_and_testing_are_chronological(self):
        series = self.series(np.tile([0., 1., 2., 0., 1., 0., 3.], 52))
        dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=7)
        # Exercise full chronological routing without a costly SARIMA grid.
        with patch('SARIMA.train_sarima', side_effect=ValueError('No converged candidate')):
            training, future = run(series, 7, dates)
        report = training['portfolio']
        self.assertEqual(len(report['outerEvaluation']), 5)
        self.assertLess(report['configurationDiscoveryEnd'], report['selectionEnd'])
        self.assertLess(report['selectionEnd'], report['outerEvaluation'][0]['start'])
        for fold in report['outerEvaluation']:
            self.assertLess(fold['trainingEnd'], fold['start'])
            self.assertLess(fold['calibrationEnd'], fold['start'])
        self.assertEqual(len(future), 7)
        self.assertTrue((future.Lower95 <= future.Forecast).all())
        self.assertTrue((future.Upper95 >= future.Forecast).all())
        self.assertFalse(report['coverageGuarantee'])

    def test_unknown_targets_do_not_count_as_accuracy_observations(self):
        series = self.series(np.tile([0., 1., 2., 0., 1., 0., 3.], 52))
        series['is_observed'] = True
        series['history_source'] = 'CSV'
        series.loc[len(series) - 35:, 'history_source'] = 'POS'
        series.loc[len(series) - 3:len(series) - 2, 'is_observed'] = False
        dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=7)
        with patch('SARIMA.train_sarima', side_effect=ValueError('No converged candidate')):
            training, _ = run(series, 7, dates)
        self.assertEqual(training['interval_calibration']['validation']['days'], 33)
        self.assertEqual(sum(f['days'] for f in training['portfolio']['actualPOSEvaluation']), 33)

    def test_legacy_switch_ignores_a_portfolio_cache(self):
        from operational_forecast import forecast
        series = self.series([1., 2.] * 40)
        dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=7)
        cached = {'kind': 'portfolio', 'history': series, 'horizon': 7, 'training': {}, 'model': None}
        future = pd.DataFrame({'Forecast': np.ones(7), 'Lower95': np.zeros(7), 'Upper95': np.ones(7)}, index=dates)
        with patch.dict(os.environ, {'FORECAST_PORTFOLIO': 'off'}), \
             patch('model_store.load', return_value=cached), patch('model_store.save', return_value=True), \
             patch('SARIMA.train_sarima', return_value={}) as fitted:
            result, _ = forecast({'series': series}, {'id': 'test', 'unit': 'g'}, 7, dates,
                lambda *args: ({'_operational_model': object(), 'exog_cols': []}, future))
        fitted.assert_called_once()
        self.assertEqual(result['modelLifecycle']['action'], 'trained')

    def test_late_fit_failure_recalibrates_a_safe_baseline(self):
        from operational_forecast import forecast
        series = self.series([1., 2.] * 180)
        dates = pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=7)
        future = pd.DataFrame({'Forecast': np.ones(7), 'Lower95': np.zeros(7), 'Upper95': np.ones(7)}, index=dates)
        training = {'portfolio': {}, 'modelLifecycle': {}}
        with patch.dict(os.environ, {'FORECAST_PORTFOLIO': 'auto'}), \
             patch('model_store.load', return_value=None), patch('model_store.save', return_value=True), \
             patch('demand_portfolio.run', side_effect=[ValueError('Optimizer did not converge'), (training, future)]) as routed:
            result, _ = forecast({'series': series}, {'id': 'test', 'unit': 'g'}, 7, dates, None)
        self.assertTrue(routed.call_args.kwargs['conservative'])
        self.assertIn('Optimizer', result['portfolio']['fallbackReason'])


if __name__ == '__main__':
    unittest.main()
