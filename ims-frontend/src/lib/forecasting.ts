import { apiJsonFetch } from './api';

export type ForecastProduct = { id: string; name: string };
export type Recommendation = {
  CurrentStock: number; SafetyStock: number; DailyDemand: number; Forecast7Days: number; ForecastTotal?: number; ForecastDays?: number;
  RecommendedPurchase: number | null; DaysRemaining: number | null; StockoutDay: number | null;
  HasInventoryData: boolean; Priority: string; Recommendation: string; ReorderPoint: number;
  quantilePolicy?: { status: string; serviceLevelTarget?: number; targetDemand?: number;
    manualReviewRequired?: boolean; missingConstraints?: string[]; finiteSampleSupported?: boolean };
};
export type ForecastSeries = {
  id: string; materialId: string; name: string; unit: string;
  points: { date: string; forecast: string; lower95: string; upper95: string }[];
  metadata: { changePercent: number | null; previous7Days?: number; previousPeriodDays?: number; previousPeriodUsage?: number; metrics: { mape: number | null; mae: number | null; wape?: number | null; mase?: number | null; rmsse?: number | null; bias?: number | null }; historicalProducts: string[];
    portfolio?: { version: number; selectedMethod: string; challengerMethod: string; bestBaseline: string;
      demandPattern: { class: string; adi: number | null; cvSquared: number | null };
      selectionFolds: number; promotionPassed: boolean; forecastValueAdded: number | null;
      periodDemand: { samples: number; quantiles: Record<string, number>; finiteSampleSupported: Record<string, boolean> } } | null;
    dataQuality?: { outlierDatesForReview: string[]; outlierTreatment: string };
    model?: string; trainingDays?: number; availableTrainingDays?: number; order?: number[]; seasonalOrder?: number[]; transformation?: string;
    candidateCount?: number | null; validationFolds?: number | null;
    calendarFeatures?: string;
    trainingSource?: string;
    modelLifecycle?: { action: string; trainedThrough: string; configurationSelectedThrough?: string;
      searchIntervalDays?: number; metricScope?: string; reason?: string };
    insights?: { evidenceStatus: 'limited' | 'caution' | 'supported'; reasons: string[];
      recentDays: number; recentPositiveDays: number; historyGapDays: number;
      estimatedTotalUsage: number; estimatedShortfall: number | null;
      dailyUpperStressTotal: number; stressShortfall: number | null;
      validation: { wape: number | null; biasPercent: number | null; seasonalNaiveSkill: number | null;
        minimumPeriodCoverage?: number; periodsAtTarget?: number; folds?: number } | null };
    predictionInterval?: { method: string; targetCoverage: number; calibrationDays?: number; maxHorizon?: number;
      coverageGuarantee: boolean; reason?: string;
      positiveDemandGuard?: boolean; positiveSampleCounts?: number[]; positiveQuantileMethods?: string[];
      requestedValidation?: { coverage: number; coveredDays: number; days: number; positiveDemandCoverage: number | null;
        positiveDemandDays: number; meanWidth: number; start: string; end: string; folds: number; horizonStart: number; horizonEnd: number } | null;
      validation: { coverage: number; coveredDays: number; days: number; positiveDemandCoverage: number | null;
        positiveDemandDays: number; meanWidth: number; start: string; end: string; folds: number } | null } | null;
    audit?: { version: number; trainingStart: string; trainingEnd: string; csvDays: number | null; posDays: number | null;
      zeroFilledDays: number; imputedDays?: number; zeroDemandDays: number; bridgeCalendarDays: number; weekdaysOnly: boolean;
      successfulCandidates: number | null; selectionMetric?: string | null; validationMethod: string | null;
      rangeCeiling?: number | null; rangeRejections?: { order: number[]; seasonal: number[]; reason: string }[];
      validationWindows: { start: string; end: string; days: number; mae: number | null; mape: number | null }[] };
  };
  recommendation: { data: Recommendation } | null;
};
export type ForecastProgress = {
  stage: string; completed: number; successful: number; total: number; currentMaterial: string | null;
  remainingSeconds: number | null; estimatedFinishAt: string | null; elapsedSeconds: number;
  estimateAvailable: boolean; stale: boolean;
};
export type ForecastRun = {
  id: string; status: 'RUNNING' | 'COMPLETED' | 'FAILED'; startDate: string; endDate: string;
  historyEnd: string | null; createdAt: string; completedAt: string | null; warnings: string[];
  error: string | null; series?: ForecastSeries[];
  progress?: ForecastProgress | null;
  noteSeries?: Pick<ForecastSeries, 'materialId' | 'name' | 'unit' | 'metadata'>[];
};
export type NextForecastPeriod = { days: number; startDate: string; endDate: string };
export type ForecastResponse = { run: ForecastRun | null; activeRun: ForecastRun | null; scope: string; periods: Pick<ForecastRun, 'id' | 'startDate' | 'endDate' | 'createdAt'>[]; nextScheduledDate: string | null; nextForecastPeriod: NextForecastPeriod; automaticRetryPending: boolean };
export const fetchForecastProducts = () => apiJsonFetch<{ products: ForecastProduct[] }>('/forecasting/products');
export const fetchForecast = (productId = '', runId = '') => apiJsonFetch<ForecastResponse>(`/forecasting/latest?${new URLSearchParams({ ...(productId ? { productId } : {}), ...(runId ? { runId } : {}) })}`);
export const fetchForecastRun = (id: string) => apiJsonFetch<{ run: ForecastRun }>(`/forecasting/runs/${encodeURIComponent(id)}`);

export const forecastPeriodDays = (run: Pick<ForecastRun, 'startDate' | 'endDate'>) => Math.round((Date.parse(run.endDate) - Date.parse(run.startDate)) / 86400000) + 1;
export const forecastTotal = (series: ForecastSeries) => series.recommendation?.data.ForecastTotal ?? series.points.reduce((total, point) => total + Number(point.forecast), 0);
