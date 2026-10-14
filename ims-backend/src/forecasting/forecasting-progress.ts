import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const progressFile = (runId: string) =>
  join(tmpdir(), `ims-forecast-${runId}.progress.json`);

export function estimateProgress(
  createdAt: Date,
  state: unknown,
  now = Date.now(),
) {
  const started = createdAt?.getTime();
  const base = {
    stage: 'preparing',
    completed: 0,
    successful: 0,
    total: 0,
    currentMaterial: null as string | null,
    remainingSeconds: null as number | null,
    estimatedFinishAt: null as string | null,
    elapsedSeconds: Number.isFinite(started)
      ? Math.max(0, Math.floor((now - started) / 1000))
      : 0,
    estimateAvailable: false,
    stale: false,
  };
  if (!state || typeof state !== 'object') return base;
  const s = state as Record<string, unknown>;
  if (
    !['preparing', 'training', 'finalizing'].includes(String(s.stage)) ||
    !Number.isInteger(s.total) ||
    !Number.isInteger(s.completed) ||
    Number(s.completed) < 0 ||
    Number(s.total) < Number(s.completed)
  )
    return base;
  const durations = Array.isArray(s.durations)
    ? s.durations.filter(
        (n): n is number =>
          typeof n === 'number' && Number.isFinite(n) && n > 0,
      )
    : [];
  const updated = Date.parse(String(s.updatedAt));
  const stale = !Number.isFinite(updated) || now - updated > 20 * 60 * 1000;
  const completed = Number(s.completed),
    total = Number(s.total);
  const samples = durations.slice(-10);
  // Estimate only after measuring three material fits. Final saving has no fabricated deadline.
  const average = samples.length
    ? samples.reduce((a, b) => a + b, 0) / samples.length
    : 0;
  const currentStart = Date.parse(String(s.currentStartedAt));
  const currentElapsed = Number.isFinite(currentStart)
    ? Math.max(0, (now - currentStart) / 1000)
    : 0;
  const remaining =
    s.stage === 'training' && !stale && samples.length >= 3 && total > completed
      ? Math.ceil(
          average * (total - completed - 1) +
            Math.max(average - currentElapsed, average * 0.15),
        )
      : null;
  return {
    ...base,
    stage: String(s.stage),
    total,
    completed,
    successful: Number.isInteger(s.successful) ? Number(s.successful) : 0,
    currentMaterial:
      typeof s.currentMaterial === 'string' ? s.currentMaterial : null,
    stale,
    remainingSeconds: remaining,
    estimatedFinishAt:
      remaining === null
        ? null
        : new Date(now + remaining * 1000).toISOString(),
    estimateAvailable: remaining !== null,
  };
}

export async function readForecastProgress(run: {
  id: string;
  createdAt: Date;
}) {
  let state: unknown;
  try {
    state = JSON.parse(await readFile(progressFile(run.id), 'utf8'));
  } catch {
    /* Older workers have no telemetry. */
  }
  return estimateProgress(run.createdAt, state);
}
