import { validateWorkerResult } from './forecasting.types';

const valid = () => ({ historyEnd: '2026-09-04', sourceHash: 'abc', warnings: [], series: [{
  materialId: 'milk', name: 'Milk', unit: 'ML', metadata: {}, recommendation: {},
  points: Array.from({ length: 7 }, (_, index) => ({ date: `2026-09-${String(7 + index).padStart(2, '0')}`, forecast: 10, lower95: 5, upper95: 15 })),
}] });

describe('Python forecast boundary validation', () => {
  it('accepts exactly seven consecutive calendar dates', () => {
    expect(validateWorkerResult(valid(), '2026-09-07').series).toHaveLength(1);
  });
  it('rejects a business-day horizon that skips the weekend', () => {
    const result = valid(); result.series[0].points[6].date = '2026-09-15';
    expect(() => validateWorkerResult(result, '2026-09-07')).toThrow();
  });
  it('rejects nonfinite quantities, invalid bounds, and duplicate materials', () => {
    const result = valid(); result.series[0].points[0].forecast = Infinity;
    expect(() => validateWorkerResult(result, '2026-09-07')).toThrow();
    const bounds = valid(); bounds.series[0].points[0].lower95 = 20;
    expect(() => validateWorkerResult(bounds, '2026-09-07')).toThrow();
    const overflow = valid(); overflow.series[0].points[0].upper95 = 1e14;
    expect(() => validateWorkerResult(overflow, '2026-09-07')).toThrow();
    const duplicates = valid(); duplicates.series.push(duplicates.series[0]);
    expect(() => validateWorkerResult(duplicates, '2026-09-07')).toThrow();
  });
});
