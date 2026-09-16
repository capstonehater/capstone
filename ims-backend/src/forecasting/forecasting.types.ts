export type WorkerPoint = { date: string; forecast: number; lower95: number; upper95: number };
export type WorkerSeries = {
  materialId: string; name: string; unit: string;
  points: WorkerPoint[];
  metadata: { [key: string]: unknown };
  recommendation: { [key: string]: unknown };
};
export type WorkerResult = {
  historyEnd: string; sourceHash: string; warnings: string[]; series: WorkerSeries[];
};

export function validateWorkerResult(value: unknown, startDate: string): WorkerResult {
  if (!value || typeof value !== 'object') throw new Error('Invalid Python output');
  const result = value as WorkerResult;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.historyEnd) || typeof result.sourceHash !== 'string' ||
      !Array.isArray(result.warnings) || result.warnings.some((warning) => typeof warning !== 'string') ||
      !Array.isArray(result.series) || result.series.length === 0) throw new Error('Python returned no valid forecasts');
  const ids = new Set<string>();
  for (const series of result.series) {
    if (typeof series.materialId !== 'string' || ids.has(series.materialId) || typeof series.name !== 'string' ||
        typeof series.unit !== 'string' || !series.metadata || !series.recommendation || !Array.isArray(series.points) || series.points.length !== 7) {
      throw new Error('Invalid or duplicate material forecast');
    }
    ids.add(series.materialId);
    series.points.forEach((point, index) => {
      const expected = new Date(`${startDate}T00:00:00Z`);
      expected.setUTCDate(expected.getUTCDate() + index);
      if (point.date !== expected.toISOString().slice(0, 10) ||
          ![point.forecast, point.lower95, point.upper95].every((number) => typeof number === 'number' && Number.isFinite(number) && number >= 0) ||
          point.lower95 > point.forecast || point.upper95 < point.forecast) throw new Error('Invalid daily forecast or confidence interval');
    });
  }
  return result;
}
