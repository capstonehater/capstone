"""Best-effort progress telemetry; never changes forecasting results."""
import json
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path


class ForecastProgress:
    def __init__(self, filename=None):
        self.path = Path(filename) if filename else None
        if self.path and (self.path.parent.resolve() != Path(tempfile.gettempdir()).resolve() or
                          not re.fullmatch(r'ims-forecast-[0-9a-f-]{36}\.progress\.json', self.path.name)):
            raise ValueError('Progress files must use the internal temporary forecast path')
        self.total = self.completed = self.successful = 0
        self.durations = []
        self.current = None
        self.stage = 'preparing'
        self.began = None
        self.write()

    def training(self, total):
        self.total = total
        self.stage = 'training'
        self.write()

    def begin(self, name):
        self.current = name
        self.began = time.perf_counter()
        self.write()

    def complete(self, successful):
        self.completed += 1
        self.successful += int(successful)
        self.durations.append(max(0, time.perf_counter() - self.began))
        self.current = None
        self.began = None
        self.write()

    def finalizing(self):
        self.stage = 'finalizing'
        self.write()

    def write(self):
        if not self.path:
            return
        data = {'stage': self.stage, 'total': self.total, 'completed': self.completed,
                'successful': self.successful, 'durations': self.durations,
                'currentMaterial': self.current,
                'currentStartedAt': datetime.now(timezone.utc).isoformat() if self.began is not None else None,
                'updatedAt': datetime.now(timezone.utc).isoformat()}
        try:
            temporary = self.path.with_suffix('.tmp')
            temporary.write_text(json.dumps(data, allow_nan=False), encoding='utf-8')
            temporary.replace(self.path)
        except OSError:
            # A status reader or temporary filesystem issue must not stop a forecast.
            pass
