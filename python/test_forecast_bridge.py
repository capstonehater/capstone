import unittest
import contextlib
import io
import numpy as np
from unittest.mock import patch
import SARIMA
import pandas as pd
from forecast_bridge import conversion, seven_calendar_days, forecast_calendar_days, match_material, generate, training_audit, select_stable_forecast
from InventoryRecommendation import build_report


class ForecastBridgeTests(unittest.TestCase):
    def test_no_safe_candidate_is_excluded_instead_of_fabricated(self):
        dates = pd.date_range('2026-09-01', periods=1)
        training = {'order': (0, 1, 0), 'seasonal': (1, 0, 0, 7), 'exog_cols': []}
        with patch.object(SARIMA, 'fit_full_model'), patch.object(SARIMA, 'forecast_future',
                return_value=pd.DataFrame({'Date': dates, 'Forecast': [1.], 'Lower95': [0.], 'Upper95': [np.inf]})):
            with self.assertRaisesRegex(ValueError, 'No validated SARIMA model passed'):
                select_stable_forecast({'series': pd.DataFrame({'qty': [10., 20.]})}, training, 1, dates)

    def test_unsafe_candidate_falls_back_without_clipping_forecast(self):
        dates = pd.date_range('2026-09-01', periods=2)
        candidates = [{'order': (0, 1, 0), 'seasonal': (1, 0, 0, 7)},
                      {'order': (1, 0, 0), 'seasonal': (1, 0, 0, 7)}]
        def result(upper):
            return pd.DataFrame({'Date': dates, 'Forecast': [10., 12.], 'Lower95': [2., 3.], 'Upper95': upper})
        with patch.object(SARIMA, 'fit_full_model'), patch.object(SARIMA, 'forecast_future', side_effect=[result(1e15), result(20.)]):
            selected, future = select_stable_forecast({'series': pd.DataFrame({'qty': [10., 20.]})},
                {'candidates': candidates, 'exog_cols': []}, 2, dates)
        self.assertEqual(selected['order'], (1, 0, 0))
        self.assertEqual(len(selected['range_rejections']), 1)
        self.assertEqual(future['Forecast'].tolist(), [10., 12.])
        self.assertEqual(future['Upper95'].tolist(), [20., 20.])

    def test_model_selection_handles_all_zero_validation_amounts(self):
        series = pd.DataFrame({'Date': pd.date_range('2026-01-01', periods=80),
                               'qty': [10.] * 50 + [0.] * 30, 'is_holiday': 0})
        with patch.dict(SARIMA.CONFIG, {'P': [0], 'D': [1], 'Q': [0], 'SP': [1], 'SD': [0], 'SQ': [0],
                                      'SEASON_LENGTH': 7, 'CV_FOLDS': 3, 'CV_HORIZON': 7, 'BOXCOX_LAMBDA': 0}), \
                patch.object(SARIMA, 'SARIMAX') as model, contextlib.redirect_stdout(io.StringIO()):
            fitted = model.return_value.fit.return_value
            fitted.forecast.side_effect = lambda days, **kwargs: np.full(days, np.log1p(1.))
            fitted.aic = 1.
            fitted.bic = 1.
            result = SARIMA.train_sarima({'series': series, 'lambda': 0})
        self.assertEqual(result['selection_metric'], 'mae')
        self.assertAlmostEqual(result['metrics']['mae'], 1.)
        self.assertTrue(np.isnan(result['metrics']['mape']))
        self.assertEqual(result['successful_candidates'], 1)
        self.assertEqual(len(result['fold_metrics']), 3)

    def test_audit_counts_only_retained_sources_and_real_validation_windows(self):
        dates = pd.date_range('2026-09-01', periods=4)
        series = pd.DataFrame({'Date': dates, 'qty': [5, 0, 0, 2]})
        history = pd.DataFrame({'date': pd.to_datetime(['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-04']),
                                'history_source': ['CSV', 'CSV', 'POS', 'POS']})
        training = {'used_cv': False, 'successful_candidates': 2,
                    'fold_metrics': [{'test': series.tail(1), 'mae': 2., 'mape': float('nan')}]}
        audit = training_audit(series, history, training, pd.Timestamp('2026-09-07'), False)
        self.assertEqual(audit['csvDays'], 1)
        self.assertEqual(audit['posDays'], 2)
        self.assertEqual(audit['zeroFilledDays'], 1)
        self.assertEqual(audit['zeroDemandDays'], 2)
        self.assertEqual(audit['bridgeCalendarDays'], 2)
        self.assertEqual(audit['validationMethod'], 'single holdout')
        self.assertEqual(audit['validationWindows'][0]['start'], '2026-09-04')
        self.assertIsNone(audit['validationWindows'][0]['mape'])

    def test_calendar_week_includes_weekend_and_crosses_month(self):
        dates = seven_calendar_days('2026-01-29')
        self.assertEqual(len(dates), 7)
        self.assertEqual(str(dates[-1].date()), '2026-02-04')
        self.assertEqual(sum(dates.dayofweek >= 5), 2)

    def test_bridge_passes_horizon_to_model_and_handles_weekend_only_period(self):
        dates = pd.date_range(end='2026-07-31', periods=1308)
        history = pd.DataFrame({'date': dates, 'product': 'Latte', 'raw_material': 'Milk',
            'item_code': 'RM-MILK', 'quantity_used': [10, 20] * 654, 'unit': 'ML', 'holiday': 0})
        series = pd.DataFrame({'Date': dates, 'qty': [10, 20] * 654})
        training = {'exog_cols': [], 'order': (1, 1, 0), 'seasonal': (1, 0, 0, 7),
                    'metrics': {'mae': 1, 'rmse': 1, 'mape': 10, 'smape': 10}}
        def predict(model, stationary, horizon, exog_cols):
            return pd.DataFrame({'Date': pd.date_range('2026-08-01', periods=horizon),
                                 'Forecast': 10., 'Lower95': 5., 'Upper95': 15.})
        for start, days in [('2026-10-01', 1), ('2026-10-01', 30), ('2026-09-26', 1)]:
            with self.subTest(start=start, days=days), patch.dict(SARIMA.CONFIG), \
                    patch('forecast_bridge.pd.read_csv', side_effect=[history.copy(), pd.DataFrame(columns=['Product'])]), \
                    patch('forecast_bridge.merge_pos_history', return_value=(history.copy(), {}, [])), \
                    patch.object(SARIMA, 'aggregate_daily_sales'), patch.object(SARIMA, 'build_holiday_lookup'), \
                    patch.object(SARIMA, 'build_daily_series', return_value=series), \
                    patch.object(SARIMA, 'make_stationary', return_value={'series': series}), \
                    patch.object(SARIMA, 'train_sarima', return_value=training), \
                    patch.object(SARIMA, 'fit_full_model'), \
                    patch.object(SARIMA, 'forecast_future', side_effect=predict) as model:
                result = generate({'startDate': start, 'forecastDays': days, 'materials': [
                    {'id': 'milk', 'sku': 'RM-MILK', 'name': 'Milk', 'unit': 'ML', 'currentStock': 15}]})
                points = result['series'][0]['points']
                self.assertEqual(len(points), days)
                self.assertEqual(points[0]['date'], start)
                self.assertEqual(points[-1]['date'], str((pd.Timestamp(start) + pd.Timedelta(days=days - 1)).date()))
                self.assertEqual(result['series'][0]['recommendation']['ForecastDays'], days)
                self.assertEqual(SARIMA.CONFIG['FORECAST_DAYS'], days)
                self.assertEqual(result['series'][0]['metadata']['trainingDays'], 1308)
                self.assertFalse(SARIMA.CONFIG['BUSINESS_DAYS_ONLY'])
                self.assertEqual(SARIMA.CONFIG['SEASON_LENGTH'], 7)
                self.assertEqual(SARIMA.CONFIG['CV_HORIZON'], (pd.Timestamp(start) - dates[-1]).days + days - 1)
                model.assert_called_once()
                self.assertEqual(points[0]['forecast'], 10)

    def test_variable_calendar_periods(self):
        for days in (1, 15, 30):
            with self.subTest(days=days):
                dates = forecast_calendar_days('2026-01-29', days)
                self.assertEqual(len(dates), days)
                self.assertEqual(dates[-1], pd.Timestamp('2026-01-29') + pd.Timedelta(days=days - 1))
        for days in (0, 31, 1.5, True, '7', None):
            with self.subTest(days=days), self.assertRaises(ValueError):
                forecast_calendar_days('2026-01-29', days)

    def test_recommendations_use_selected_period_for_daily_demand_and_purchase(self):
        for days in (1, 15, 30):
            with self.subTest(days=days):
                forecast = pd.DataFrame({'Date': forecast_calendar_days('2026-01-29', days),
                    'RawMaterial': ['Milk'] * days, 'Unit': ['ML'] * days, 'Forecast': [10] * days,
                    'MAE': [1] * days, 'RMSE': [1] * days, 'MAPE': [10] * days, 'SMAPE': [10] * days})
                stock = pd.DataFrame([{'Product': 'Milk', 'CurrentStock': 15, 'SafetyStock': 5, 'LeadTime': 2}])
                report = build_report(forecast, stock).iloc[0]
                self.assertEqual(report['ForecastDays'], days)
                self.assertEqual(report['ForecastTotal'], days * 10)
                self.assertEqual(report['DailyDemand'], 10)
                self.assertEqual(report['RecommendedPurchase'], max(0, days * 10 - 10))
                self.assertEqual(report['DaysRemaining'], 1.5)

    def test_unit_conversion_and_incompatible_units(self):
        self.assertEqual(conversion('kg', 'G'), 1000)
        self.assertEqual(conversion('L', 'ML'), 1000)
        with self.assertRaises(ValueError):
            conversion('kg', 'PCS')

    def test_matching_uses_sku_and_rejects_ambiguous_names(self):
        rows = pd.DataFrame([{'item_code': 'RM-ONE', 'raw_material': 'Milk'}])
        self.assertEqual(match_material(rows, [{'id': 'one', 'sku': 'RM-ONE', 'name': 'Fresh Milk'}])['id'], 'one')
        with self.assertRaises(ValueError):
            match_material(rows, [{'id': str(i), 'sku': str(i), 'name': 'Milk'} for i in range(2)])

    def test_recommendations_interpret_seven_calendar_days(self):
        forecast = pd.DataFrame({'Date': seven_calendar_days('2026-09-07'), 'RawMaterial': ['Milk'] * 7,
            'Unit': ['ML'] * 7, 'Forecast': [10, 10, 10, 10, 10, 0, 0],
            'MAE': [1] * 7, 'RMSE': [1] * 7, 'MAPE': [10] * 7, 'SMAPE': [10] * 7})
        inventory = pd.DataFrame([{'Product': 'Milk', 'CurrentStock': 15, 'SafetyStock': 5, 'LeadTime': 2}])
        report = build_report(forecast, inventory).iloc[0]
        self.assertEqual(report['Forecast7Days'], 50)
        self.assertEqual(report['StockoutDay'], 2)
        self.assertEqual(report['RecommendedPurchase'], 40)
        self.assertEqual(report['Priority'], 'Critical')


if __name__ == '__main__':
    unittest.main()
