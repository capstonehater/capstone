import { apiJsonFetch } from './api';

export type ForecastProduct = { id: string; name: string };
export type Recommendation = {
  CurrentStock: number; SafetyStock: number; DailyDemand: number; Forecast7Days: number;
  RecommendedPurchase: number | null; DaysRemaining: number | null; StockoutDay: number | null;
  HasInventoryData: boolean; Priority: string; Recommendation: string; ReorderPoint: number;
};
export type ForecastSeries = {
  id: string; materialId: string; name: string; unit: string;
  points: { date: string; forecast: string; lower95: string; upper95: string }[];
  metadata: { changePercent: number | null; previous7Days: number; metrics: { mape: number | null; mae: number | null }; historicalProducts: string[] };
  recommendation: { data: Recommendation } | null;
};
export type ForecastRun = {
  id: string; status: 'RUNNING' | 'COMPLETED' | 'FAILED'; startDate: string; endDate: string;
  historyEnd: string | null; createdAt: string; completedAt: string | null; warnings: string[];
  error: string | null; series?: ForecastSeries[];
};
export type ForecastResponse = { run: ForecastRun | null; activeRun: ForecastRun | null; scope: string };
export const fetchForecastProducts = () => apiJsonFetch<{ products: ForecastProduct[] }>('/forecasting/products');
export const fetchForecast = (productId = '') => apiJsonFetch<ForecastResponse>(`/forecasting/latest${productId ? `?productId=${encodeURIComponent(productId)}` : ''}`);
export const generateForecast = (startDate: string) => apiJsonFetch<{ run: ForecastRun }>('/forecasting/runs', { method: 'POST', body: JSON.stringify({ startDate }) });
export const fetchForecastRun = (id: string) => apiJsonFetch<{ run: ForecastRun }>(`/forecasting/runs/${encodeURIComponent(id)}`);
