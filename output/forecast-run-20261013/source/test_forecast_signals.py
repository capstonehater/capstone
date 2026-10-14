import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import pandas as pd
from forecast_signals import features
from constrained_sarima import features as calendar_features


class SignalTests(unittest.TestCase):
    def test_signal_known_after_origin_cannot_leak_into_backcast(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'events.json'
            path.write_text(json.dumps([
                {'date': '2026-08-04', 'knownOn': '2026-08-05', 'heavyRain': 1},
                {'date': '2026-08-05', 'knownOn': '2026-07-31', 'promotion': 1}]))
            with patch.dict(os.environ, {'FORECAST_EVENT_FILE': str(path)}):
                result = features(pd.date_range('2026-08-01', periods=7), '2026-08-01')
                self.assertEqual(result.heavyRain.sum(), 0)
                self.assertEqual(result.promotion.sum(), 1)

    def test_payday_flags_are_calendar_features_not_assumed_effects(self):
        dates = pd.to_datetime(['2026-02-15', '2026-02-28', '2026-03-30'])
        result = calendar_features(dates, [0, 0, 0], 'weekday_payday')
        self.assertEqual(result.payday_15_30.tolist(), [1, 0, 1])


if __name__ == '__main__':
    unittest.main()
