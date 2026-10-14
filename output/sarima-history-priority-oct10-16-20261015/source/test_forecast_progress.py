import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from forecast_progress import ForecastProgress

class ProgressTests(unittest.TestCase):
    def test_progress_records_real_durations_and_completion(self):
        path = Path(tempfile.gettempdir()) / 'ims-forecast-00000000-0000-0000-0000-000000000000.progress.json'
        try:
            progress = ForecastProgress(str(path))
            progress.training(2)
            with patch('forecast_progress.time.perf_counter', side_effect=[100, 160]):
                progress.begin('Milk')
                progress.complete(True)
            data = json.loads(path.read_text())
            self.assertEqual(data['completed'], 1)
            self.assertEqual(data['successful'], 1)
            self.assertEqual(data['durations'], [60])
            progress.finalizing()
            self.assertEqual(json.loads(path.read_text())['stage'], 'finalizing')
        finally:
            path.unlink(missing_ok=True)
            path.with_suffix('.tmp').unlink(missing_ok=True)

    def test_rejects_non_internal_file(self):
        with self.assertRaises(ValueError):
            ForecastProgress('historical-raw-material-data.csv')

    def test_no_path_keeps_old_worker_requests_compatible(self):
        progress = ForecastProgress()
        progress.training(1)
        progress.begin('Milk')
        progress.complete(False)
        self.assertEqual(progress.completed, 1)
        self.assertEqual(progress.successful, 0)

if __name__ == '__main__': unittest.main()
