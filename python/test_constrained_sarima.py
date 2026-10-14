import unittest
import ast
from pathlib import Path
from unittest.mock import patch
import numpy as np
import pandas as pd

import constrained_sarima as constrained


class ConstrainedSarimaTests(unittest.TestCase):
    def test_unknown_days_do_not_improve_pooled_or_volume_scores(self):
        test = pd.DataFrame({'qty': [10., 1000.]})
        fold = {**constrained.metrics([10.], [5.]), 'aic': 1., 'bic': 1.,
                'test': test, 'predictions': np.array([5., 1000.]),
                'observed_mask': np.array([True, False])}
        result = constrained.aggregate_candidate(constrained.candidate_specs()[0], [fold], [])
        self.assertEqual(result['metrics']['wape'], 50.)
        self.assertEqual(result['metrics']['period_volume_error'], 50.)

    def test_historical_low_mape_candidates_use_current_trading_calendar(self):
        historical = constrained.historical_candidate_specs()
        self.assertEqual(len(historical), 13)
        self.assertTrue(all(spec['seasonal'][3] == 7 for spec in historical))
        self.assertTrue(any(spec['seasonal'][1] == 1 for spec in historical))
        self.assertTrue(all(spec in constrained.candidate_specs() for spec in historical))
        self.assertEqual(len({str(spec) for spec in constrained.candidate_specs()}),
                         len(constrained.candidate_specs()))

    def test_historical_orders_are_backed_by_archived_low_mape_runs(self):
        archive = pd.read_csv(Path(__file__).parent / '_archive' /
                              'catalog-update-052f2ec2' / 'forecast_database.csv', header=None)
        scores = pd.to_numeric(archive[14], errors='coerce')
        recovered = set()
        for _, row in archive[(scores >= 0) & (scores < 30)].iterrows():
            seasonal = ast.literal_eval(row[9])
            recovered.add((ast.literal_eval(row[8]), (*seasonal[:3], 7)))
        self.assertEqual({(s['order'], s['seasonal']) for s in constrained.historical_candidate_specs()},
                         recovered)

    def test_nonfinite_error_cannot_bypass_model_selection_guards(self):
        with self.assertRaisesRegex(ValueError, 'Finite nonnegative'):
            constrained.rank_candidates([{'metrics': {'mae': np.nan, 'mape': 0.}}])

    def test_volume_winner_must_preserve_daily_error_guards(self):
        def candidate(mae, mape, rmse, volume):
            return {'metrics': {'mae': mae, 'mape': mape, 'rmse': rmse, 'period_volume_error': volume}}
        candidates = [candidate(10, 40, 20, 70), candidate(10.5, 43, 21, 30),
                      candidate(12, 41, 20, 1), candidate(10.2, 45, 20, 1), candidate(10.2, 41, 23, 1)]
        ranked, _, limit, criterion = constrained.rank_candidates(candidates, volume_estimation=True)
        self.assertEqual(ranked[0]['metrics']['period_volume_error'], 30)
        self.assertEqual(len(ranked), 2)
        self.assertAlmostEqual(limit, 11)
        self.assertEqual(criterion, 'period_volume_error_with_mae_mape_rmse_guards')

    def test_volume_metrics_include_zero_day_false_positives(self):
        errors = constrained.metrics([0., 10.], [10., 10.])
        self.assertEqual(errors['wape'], 100.)
        self.assertEqual(errors['bias_pct'], 100.)
        self.assertTrue(np.isnan(constrained.metrics([0.], [10.])['wape']))

    def test_weekday_columns_match_future_calendar(self):
        features = constrained.features(pd.date_range('2026-10-12', periods=7), [0] * 7, 'weekday')
        self.assertEqual(features.iloc[0].sum(), 0)
        self.assertEqual(features.weekday_6.tolist(), [0, 0, 0, 0, 0, 0, 1])

    def test_long_interval_testing_only_fits_grid_on_selection_folds(self):
        series = pd.DataFrame({'Date': pd.date_range('2025-01-01', periods=500),
            'qty': np.ones(500), 'is_holiday': np.zeros(500)})
        class Model:
            aic = bic = 1.
        with patch.object(constrained, 'candidate_specs', return_value=[constrained.candidate_specs()[0]]), \
                patch.object(constrained, 'fit', return_value=Model()) as fitted, \
                patch.object(constrained, 'predict', side_effect=lambda model, dates, holidays, interval=False:
                             np.tile([1., 0., 2.], (len(dates), 1))) as predicted:
            result = constrained.train({'series': series}, {'CV_HORIZON': 14, 'FORECAST_DAYS': 7,
                'CV_FOLDS': 3, 'INTERVAL_CALIBRATION_FOLDS': 12, 'INTERVAL_VALIDATION_FOLDS': 5})
        self.assertEqual(predicted.call_count, 6)
        # Six selection fits plus validation and production convergence refits.
        self.assertEqual(fitted.call_count, 8)
        self.assertEqual(result['test'].Date.max(), series.Date.max())
        self.assertLess(result['interval_validation_candidate']['fold_metrics'][-1]['test'].Date.max(),
                        series.iloc[-70].Date)

    def test_mape_winner_cannot_bypass_mae_guard(self):
        candidates = [{"metrics": {"mae": 10., "mape": 80.}},
                      {"metrics": {"mae": 10.5, "mape": 40.}},
                      {"metrics": {"mae": 12., "mape": 10.}}]
        ranked, best, limit, selection = constrained.rank_candidates(candidates, .10)
        self.assertEqual(ranked[0]["metrics"]["mape"], 40.)
        self.assertEqual(best, 10.)
        self.assertAlmostEqual(limit, 11.)
        self.assertEqual(len(ranked), 2)
        self.assertEqual(selection, "mape_with_mae_guard")

    def test_zero_demand_keeps_absolute_error_and_undefined_mape(self):
        errors = constrained.metrics(np.zeros(3), np.ones(3))
        self.assertEqual(errors["mae"], 1.)
        self.assertTrue(np.isnan(errors["mape"]))
        candidates = [{"metrics": {"mae": 2., "mape": np.nan}},
                      {"metrics": {"mae": 1., "mape": np.nan}}]
        self.assertEqual(constrained.rank_candidates(candidates)[3], "mae")
        # Zero-day false positives are penalized even when positive-day MAPE is perfect.
        self.assertEqual(constrained.metrics([0., 10.], [10., 10.])["mae"], 5.)

    def test_selection_score_is_distinct_from_undefined_reported_fold_average(self):
        candidates = [{"metrics": {"mae": 10., "mape": np.nan}, "selection_mape": 60.},
                      {"metrics": {"mae": 10.5, "mape": np.nan}, "selection_mape": 40.}]
        ranked, _, _, criterion = constrained.rank_candidates(candidates)
        self.assertEqual(ranked[0]["selection_mape"], 40.)
        self.assertTrue(np.isnan(ranked[0]["metrics"]["mape"]))
        self.assertEqual(criterion, "mape_with_mae_guard")

    def test_unconverged_fit_is_rejected(self):
        series = pd.DataFrame({"Date": pd.date_range("2026-01-01", periods=70),
            "qty": np.ones(70), "is_holiday": np.zeros(70)})
        with patch.object(constrained, "SARIMAX") as constructor:
            constructor.return_value.fit.return_value.mle_retvals = {"converged": False}
            with self.assertRaisesRegex(ValueError, "converge"):
                constrained.fit(series, constrained.candidate_specs()[0])

    def test_validation_never_uses_future_observations(self):
        series = pd.DataFrame({"Date": pd.date_range("2026-01-01", periods=100),
            "qty": np.arange(100, dtype=float), "is_holiday": np.zeros(100)})
        class Model:
            aic = 1.
            bic = 1.
        def fit(training, candidate):
            model = Model()
            model.last_date = training.Date.max()
            return model
        def predict(model, dates, holidays, interval=False):
            self.assertLess(model.last_date, dates.min())
            return np.zeros((len(dates), 3)) if interval else np.zeros(len(dates))
        with patch.object(constrained, "candidate_specs", return_value=[constrained.candidate_specs()[0]]), \
                patch.object(constrained, "fit", side_effect=fit), \
                patch.object(constrained, "predict", side_effect=predict):
            result = constrained.train({"series": series}, {"CV_HORIZON": 7, "FORECAST_DAYS": 7, "CV_FOLDS": 3})
        self.assertEqual(len(result["fold_metrics"]), 3)

    def test_future_holiday_feature_uses_supplied_calendar_flags(self):
        features = constrained.features(pd.date_range("2026-01-22", periods=7), [0, 1, 0, 0, 0, 0, 0], "level")
        self.assertEqual(features.is_holiday.tolist(), [0., 1., 0., 0., 0., 0., 0.])
        self.assertTrue(np.isfinite(features.to_numpy()).all())



if __name__ == "__main__":
    unittest.main()
