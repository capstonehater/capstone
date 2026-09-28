import { apiJsonFetch } from './api';

export type ForecastProduct = { id: string; name: string };
export type Recommendation = {
  CurrentStock: number; SafetyStock: number; DailyDemand: number; Forecast7Days: number; ForecastTotal?: number; ForecastDays?: number;
  RecommendedPurchase: number | null; DaysRemaining: number | null; StockoutDay: number | null;
  HasInventoryData: boolean; Priority: string; Recommendation: string; ReorderPoint: number;
};
export type ForecastSeries = {
  id: string; materialId: string; name: string; unit: string;
  points: { date: string; forecast: string; lower95: string; upper95: string }[];
  metadata: { changePercent: number | null; previous7Days?: number; previousPeriodDays?: number; previousPeriodUsage?: number; metrics: { mape: number | null; mae: number | null }; historicalProducts: string[] };
  recommendation: { data: Recommendation } | null;
};
export type ForecastRun = {
  id: string; status: 'RUNNING' | 'COMPLETED' | 'FAILED'; startDate: string; endDate: string;
  historyEnd: string | null; createdAt: string; completedAt: string | null; warnings: string[];
  error: string | null; series?: ForecastSeries[];
};
export type NextForecastPeriod = { days: number; startDate: string; endDate: string };
export type ForecastResponse = { run: ForecastRun | null; activeRun: ForecastRun | null; scope: string; periods: Pick<ForecastRun, 'id' | 'startDate' | 'endDate' | 'createdAt'>[]; nextScheduledDate: string | null; nextForecastPeriod: NextForecastPeriod; automaticRetryPending: boolean };
export const fetchForecastProducts = () => apiJsonFetch<{ products: ForecastProduct[] }>('/forecasting/products');
export const fetchForecast = (productId = '', runId = '') => apiJsonFetch<ForecastResponse>(`/forecasting/latest?${new URLSearchParams({ ...(productId ? { productId } : {}), ...(runId ? { runId } : {}) })}`);
export const fetchForecastRun = (id: string) => apiJsonFetch<{ run: ForecastRun }>(`/forecasting/runs/${encodeURIComponent(id)}`);

export const saveForecastSettings = (forecastDays: number) => apiJsonFetch<{ nextForecastPeriod: NextForecastPeriod }>('/forecasting/settings', {
  method: 'PUT', body: JSON.stringify({ forecastDays }),
});
export const forecastPeriodDays = (run: Pick<ForecastRun, 'startDate' | 'endDate'>) => Math.round((Date.parse(run.endDate) - Date.parse(run.startDate)) / 86400000) + 1;
export const forecastTotal = (series: ForecastSeries) => series.recommendation?.data.ForecastTotal ?? series.points.reduce((total, point) => total + Number(point.forecast), 0);
