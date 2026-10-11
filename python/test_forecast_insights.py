import unittest
import numpy as np
import pandas as pd
from forecast_insights import build_insights


class ForecastInsightTests(unittest.TestCase):
    def inputs(self):
        series = pd.DataFrame({'Date': pd.date_range('2026-01-01', periods=100), 'qty': np.ones(100)})
        future = pd.DataFrame({'Forecast': [10., 20.], 'Upper95': [30., 40.]},
            index=pd.date_range(series.Date.max() + pd.Timedelta(days=1), periods=2))
        return series, future

    def test_perfect_zero_coverage_cannot_pass_evidence_checks(self):
        series, future = self.inputs()
        series.qty = 0.
        training = {'interval_calibration': {'targetCoverage': .95, 'requestedValidation':
            {'days': 7, 'positiveDemandDays': 0, 'coverage': 1., 'positiveDemandCoverage': None}}}
        result = build_insights(series, training, future, None)
        self.assertEqual(result['evidenceStatus'], 'limited')
        self.assertIsNone(result['estimatedShortfall'])
        self.assertIsNone(result['stressShortfall'])

    def test_inventory_scenarios_do_not_become_weekly_confidence_bounds(self):
        series, future = self.inputs()
        result = build_insights(series, {}, future, 25.)
        self.assertEqual(result['estimatedShortfall'], 5.)
        self.assertEqual(result['stressShortfall'], 45.)
        self.assertIn('not a 95%', result['stressScenarioInterpretation'])

    def test_failing_baseline_or_spike_coverage_requires_caution(self):
        series, future = self.inputs()
        validation = {'days': 42, 'positiveDemandDays': 30, 'coverage': .98,
            'positiveDemandCoverage': .90, 'wape': 25., 'seasonalNaiveSkill': -.2}
        training = {'interval_calibration': {'targetCoverage': .95, 'validation': validation}}
        self.assertEqual(build_insights(series, training, future, 25.)['evidenceStatus'], 'caution')
        validation.update(positiveDemandCoverage=.98, seasonalNaiveSkill=.2)
        self.assertEqual(build_insights(series, training, future, 25.)['evidenceStatus'], 'supported')
        validation['minimumPeriodCoverage'] = .5
        self.assertEqual(build_insights(series, training, future, 25.)['evidenceStatus'], 'caution')


if __name__ == '__main__':
    unittest.main()
