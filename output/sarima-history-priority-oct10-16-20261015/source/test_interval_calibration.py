import unittest
from unittest.mock import patch
import numpy as np
import pandas as pd
import constrained_sarima as constrained
from interval_calibration import quantile, apply, calibrate, summarize, requested_validation


class IntervalCalibrationTests(unittest.TestCase):
    def test_spike_guard_and_zero_support_do_not_change_estimates(self):
        values = np.tile([10., 8., 12.], (7, 1))
        result = apply(values, {'method': 'rolling_residual_calibration', 'scaleFloor': 1.,
            'maxHorizon': 7, 'factors': [1.], 'positiveUpperFactors': [10.],
            'zeroDemandFrequency': .5})
        np.testing.assert_equal(result[:, 0], values[:, 0])
        np.testing.assert_equal(result[:, 1], 0.)
        np.testing.assert_equal(result[:, 2], 30.)

    def test_sparse_positive_samples_are_labeled_as_observed_maximum(self):
        series = pd.DataFrame({'Date': pd.date_range('2026-01-01', periods=160),
            'qty': np.zeros(160), 'is_holiday': np.zeros(160)})
        series.loc[[110, 130], 'qty'] = 10
        plan = {'horizon': 7, 'selectionEnd': 139, 'calibrationFolds': 6,
                'evaluationFolds': 3, 'positiveDemandGuard': True}
        with patch.object(constrained, 'fit', return_value=object()), \
                patch.object(constrained, 'predict', side_effect=lambda model, dates, holidays, interval=False:
                             np.tile([0., 0., 1.], (len(dates), 1))):
            result = calibrate(series, {}, plan)
        self.assertEqual(result['validation']['windows'][0]['positiveSampleCounts'], [2])
        self.assertIn('observed_positive_maximum', result['positiveQuantileMethods'])
        self.assertFalse(result['coverageGuarantee'])

    def test_matched_horizon_sums_metrics_without_averaging_percentages(self):
        rows = [{'day': i, 'days': 1, 'coveredDays': 1, 'positiveDemandDays': 1,
            'positiveDemandCoveredDays': 1, 'meanWidth': 1., 'start': '2026-01-01', 'end': '2026-01-01',
            'actualTotal': total, 'forecastTotal': forecast, 'absoluteErrorTotal': error,
            'baselineAbsoluteErrorTotal': baseline} for i, total, forecast, error, baseline
                in [(1, 1., 0., 1., 2.), (2, 9., 6., 3., 6.)]]
        result = requested_validation({'validation': {'byHorizon': rows, 'folds': 1}}, 1, 2)
        self.assertEqual(result['wape'], 40.)
        self.assertEqual(result['biasPercent'], -40.)
        self.assertEqual(result['seasonalNaiveSkill'], .5)

    def test_period_coverage_is_matched_to_requested_horizon(self):
        row = {'day': 8, 'days': 1, 'coveredDays': 1, 'positiveDemandDays': 1,
            'positiveDemandCoveredDays': 1, 'meanWidth': 2., 'start': '2026-01-08', 'end': '2026-01-08'}
        window = {'byHorizon': [{**row, 'date': '2026-01-08'},
            {**row, 'day': 1, 'date': '2026-01-01', 'coveredDays': 0}]}
        interval = {'targetCoverage': .95, 'validation': {'byHorizon': [row], 'folds': 1, 'windows': [window]}}
        result = requested_validation(interval, 8, 14)
        self.assertEqual(result['minimumPeriodCoverage'], 1.)
        self.assertEqual(result['periodsAtTarget'], 1)
        self.assertEqual(result['periods'][0]['start'], '2026-01-08')

    def test_finite_sample_quantile_uses_order_statistic(self):
        self.assertEqual(quantile(np.arange(20)), 19.)
        self.assertEqual(quantile(np.arange(40)), 38.)
        with self.assertRaisesRegex(ValueError, 'Too few'):
            quantile(np.arange(18))

    def test_coverage_counts_zeros_and_reports_positive_demand_separately(self):
        values = np.array([[0, 0, 2], [0, 0, 2], [0, 0, 2]], dtype=float)
        result = summarize([0, 0, 5], values)
        self.assertAlmostEqual(result['coverage'], 2 / 3)
        self.assertEqual(result['positiveDemandCoverage'], 0.)
        self.assertEqual(result['positiveDemandDays'], 1)
        self.assertGreater(result['intervalScore'], result['meanWidth'])

    def test_calibration_preserves_point_estimates_and_horizon_buckets(self):
        values = np.tile([10., 8., 12.], (14, 1))
        result = apply(values, {'method': 'rolling_residual_calibration', 'scaleFloor': 1.,
            'maxHorizon': 14, 'factors': [1., 3.]})
        np.testing.assert_equal(result[:, 0], values[:, 0])
        self.assertEqual(result[0, 1], 8.)
        self.assertEqual(result[7, 1], 4.)
        self.assertEqual(result[7, 2], 16.)
        with self.assertRaisesRegex(ValueError, 'horizon'):
            apply(np.tile([10., 8., 12.], (15, 1)), {'method': 'rolling_residual_calibration',
                'scaleFloor': 1., 'maxHorizon': 14, 'factors': [1., 3.]})

    def test_calibration_and_validation_are_chronologically_disjoint(self):
        series = pd.DataFrame({'Date': pd.date_range('2026-01-01', periods=160),
            'qty': np.ones(160), 'is_holiday': np.zeros(160)})
        plan = {'horizon': 7, 'selectionEnd': 139, 'calibrationFolds': 6, 'evaluationFolds': 3}
        seen = []
        def fit(training, candidate):
            return training.Date.max()
        def predict(last, dates, holidays, interval=False):
            self.assertLess(last, dates.min())
            seen.extend(dates)
            return np.tile([1., 0., 2.], (len(dates), 1))
        with patch.object(constrained, 'fit', side_effect=fit), patch.object(constrained, 'predict', side_effect=predict):
            result = calibrate(series, {}, plan)
            changed = series.copy()
            changed.loc[139:, 'qty'] = 10000
            altered = calibrate(changed, {}, plan)
        self.assertEqual(result['validation']['windows'][0]['factors'], altered['validation']['windows'][0]['factors'])
        self.assertNotEqual(result['factors'], altered['factors'])
        self.assertEqual(result['calibrationDays'], 42)
        self.assertEqual(result['validation']['days'], 21)
        for window in result['validation']['windows']:
            self.assertLess(window['calibrationEnd'], window['start'])
        self.assertNotEqual(result['validation']['coverage'], altered['validation']['coverage'])

    def test_candidate_selection_excludes_interval_holdouts(self):
        series = pd.DataFrame({'Date': pd.date_range('2025-01-01', periods=300),
            'qty': np.arange(300, dtype=float), 'is_holiday': np.zeros(300)})
        class Model:
            aic = bic = 1.
        with patch.object(constrained, 'candidate_specs', return_value=[constrained.candidate_specs()[0]]), \
                patch.object(constrained, 'fit', return_value=Model()), \
                patch.object(constrained, 'predict', side_effect=lambda model, dates, holidays, interval=False: np.zeros((len(dates), 3))):
            result = constrained.train({'series': series}, {'CV_HORIZON': 14, 'FORECAST_DAYS': 7, 'CV_FOLDS': 3})
        selection_end = result['interval_plan']['selectionEnd']
        self.assertEqual(selection_end, 286)
        earlier = result['interval_validation_candidate']
        self.assertLess(earlier['fold_metrics'][-1]['test'].Date.max(), series.iloc[selection_end].Date)
        self.assertEqual(result['test'].Date.max(), series.Date.max())

    def test_requested_week_coverage_accounts_for_history_gap(self):
        early = {'day': 1, 'days': 3, 'coveredDays': 3, 'positiveDemandDays': 0,
            'positiveDemandCoveredDays': 0, 'meanWidth': 2., 'start': '2026-01-01', 'end': '2026-01-29'}
        later = {'day': 8, 'days': 3, 'coveredDays': 1, 'positiveDemandDays': 2,
            'positiveDemandCoveredDays': 1, 'meanWidth': 4., 'start': '2026-01-08', 'end': '2026-02-05'}
        interval = {'validation': {'byHorizon': [early, later], 'start': '2026-01-01',
            'end': '2026-02-12', 'folds': 3}}
        result = requested_validation(interval, 8, 14)
        self.assertEqual(result['days'], 3)
        self.assertAlmostEqual(result['coverage'], 1 / 3)
        self.assertEqual(result['positiveDemandCoverage'], .5)
        self.assertEqual(result['meanWidth'], 4.)
        self.assertEqual(result['start'], '2026-01-08')
        self.assertEqual(result['end'], '2026-02-05')

    def test_failed_calibration_does_not_claim_empirical_coverage(self):
        series = pd.DataFrame({'Date': pd.date_range('2026-01-01', periods=160),
            'qty': np.ones(160), 'is_holiday': np.zeros(160)})
        plan = {'horizon': 7, 'selectionEnd': 139, 'calibrationFolds': 6, 'evaluationFolds': 3}
        with patch.object(constrained, 'fit', side_effect=ValueError('nonconvergence')):
            result = calibrate(series, {}, plan)
        self.assertEqual(result['method'], 'model_based')
        self.assertIsNone(result['validation'])
        self.assertEqual(result['calibrationDays'], 0)

    def test_numerical_noise_cannot_exclude_zero_usage(self):
        values = np.tile([1e-40, 1e-40, 1e-40], (7, 1))
        result = apply(values, {'method': 'rolling_residual_calibration', 'scaleFloor': 1e-8,
            'maxHorizon': 7, 'factors': [0.]})
        self.assertEqual(summarize(np.zeros(7), result)['coverage'], 1.)
        np.testing.assert_array_equal(result[:, 0], values[:, 0])

    def test_latest_usage_updates_production_selection_without_changing_prior_selection(self):
        dates = pd.date_range('2025-01-01', periods=300)
        series = pd.DataFrame({'Date': dates, 'qty': np.ones(300) * 2, 'is_holiday': np.zeros(300)})
        specs = constrained.candidate_specs()[:2]
        specs[0] = {**specs[0], 'window': 182}
        specs[1] = {**specs[1], 'window': 365}
        class Model:
            aic = bic = 1.
        def fit(training, candidate):
            model = Model()
            model.window = candidate['window']
            return model
        def predict(model, forecast_dates, holidays, interval=False):
            value = 100. if model.window == 365 and forecast_dates.min() >= dates[286] else 2.
            return np.tile([value, max(0, value - 1), value + 1], (len(forecast_dates), 1))
        config = {'CV_HORIZON': 14, 'FORECAST_DAYS': 7, 'CV_FOLDS': 3}
        with patch.object(constrained, 'candidate_specs', return_value=specs), \
                patch.object(constrained, 'fit', side_effect=fit), patch.object(constrained, 'predict', side_effect=predict):
            before = constrained.train({'series': series}, config)
            series.loc[286:, 'qty'] = 100.
            after = constrained.train({'series': series}, config)
        self.assertEqual(before['window'], 182)
        self.assertEqual(after['window'], 365)
        self.assertEqual(before['interval_validation_candidate']['window'], 182)
        self.assertEqual(after['interval_validation_candidate']['window'], 182)


if __name__ == '__main__':
    unittest.main()
