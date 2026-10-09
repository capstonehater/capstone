import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';

const SEED_NAMESPACE = 'cafe-salvacion-synthetic-history-v1';

/** Stable UUIDs make reruns append-only and safe to retry after a partial failure. */
export function stableId(kind: string, key: string | number): string {
  const bytes = createHash('sha256')
    .update(`${SEED_NAMESPACE}:${kind}:${key}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function rngFor(seed: string): () => number {
  let state = createHash('sha256').update(`${SEED_NAMESPACE}:${seed}`).digest().readUInt32LE(0);
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function decimal(value: number, scale = 4): Prisma.Decimal {
  const finite = Number.isFinite(value) ? value : 0;
  return new Prisma.Decimal(finite.toFixed(scale));
}

export function dateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function manilaDateTime(date: string, hour: number, minute = 0, second = 0): Date {
  const padded = (value: number) => String(value).padStart(2, '0');
  return new Date(`${date}T${padded(hour)}:${padded(minute)}:${padded(second)}+08:00`);
}

export function addDays(date: string, days: number): string {
  const value = dateOnly(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function subtractCalendarYears(date: string, years: number): string {
  const value = dateOnly(date);
  const month = value.getUTCMonth();
  value.setUTCFullYear(value.getUTCFullYear() - years);
  // Keep the result valid when the current business date is February 29.
  if (value.getUTCMonth() !== month) value.setUTCDate(0);
  return value.toISOString().slice(0, 10);
}

export function manilaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function daysBetween(start: string, endExclusive: string): string[] {
  const dates: string[] = [];
  for (let date = start; date < endExclusive; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function weightedChoice<T>(items: Array<{ value: T; weight: number }>, random: () => number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let point = random() * total;
  for (const item of items) {
    point -= item.weight;
    if (point <= 0) return item.value;
  }
  return items[items.length - 1].value;
}
