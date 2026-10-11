import { estimateProgress } from './forecasting-progress';

describe('forecast progress estimates', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const createdAt = new Date(now - 600000);
  const state = { stage: 'training', completed: 3, total: 10, successful: 3,
    durations: [60, 90, 120], currentMaterial: 'Milk',
    currentStartedAt: new Date(now - 30000).toISOString(), updatedAt: new Date(now).toISOString() };
  it('counts elapsed time without inventing a finish for an older worker', () => {
    expect(estimateProgress(createdAt, null, now)).toMatchObject({ elapsedSeconds: 600, remainingSeconds: null, estimatedFinishAt: null });
  });
  it('waits for three measured fits', () => {
    expect(estimateProgress(createdAt, { ...state, completed: 2, durations: [60, 90] }, now).estimateAvailable).toBe(false);
  });
  it('uses measured fit time and subtracts time on the current material', () => {
    const result = estimateProgress(createdAt, state, now);
    expect(result.remainingSeconds).toBe(600);
    expect(result.estimatedFinishAt).toBe(new Date(now + 600000).toISOString());
  });
  it('moves the estimate later when a material exceeds the measured average', () => {
    expect(estimateProgress(createdAt, state, now + 120000).remainingSeconds).toBe(554);
  });
  it('withholds estimates when progress is stale', () => {
    expect(estimateProgress(createdAt, state, now + 21 * 60000)).toMatchObject({ stale: true, remainingSeconds: null });
  });
  it('does not claim the forecast is complete while results are being saved', () => {
    expect(estimateProgress(createdAt, { ...state, stage: 'finalizing', completed: 10 }, now).estimatedFinishAt).toBeNull();
  });
  it('handles missing timestamps on legacy status responses', () => {
    expect(estimateProgress(new Date('invalid'), null, now).elapsedSeconds).toBe(0);
  });
  it('rejects invalid counters', () => {
    expect(estimateProgress(createdAt, { ...state, completed: 11 }, now).estimateAvailable).toBe(false);
  });
});
