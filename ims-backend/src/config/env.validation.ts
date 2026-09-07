import { loadEnvFile } from 'node:process';

loadEnvFile();

type SameSite = 'lax' | 'strict' | 'none';

function requireString(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function parsePositiveInt(name: string, fallback: number): number {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer`);
  }

  return parsed;
}

function parseBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true' || normalized === '1') {
    return true;
  }

  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  throw new Error(`Environment variable ${name} must be a boolean`);
}

export function readBooleanEnv(name: string, fallback: boolean): boolean {
  return parseBoolean(name, fallback);
}

function parseSameSite(name: string, fallback: SameSite): SameSite {
  const value = process.env[name];

  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();

  if (
    normalized === 'lax' ||
    normalized === 'strict' ||
    normalized === 'none'
  ) {
    return normalized;
  }

  throw new Error(
    `Environment variable ${name} must be one of: lax, strict, none`,
  );
}

const nodeEnv = (process.env.NODE_ENV ?? 'development').trim();
const sessionTokenSecret = requireString('SESSION_TOKEN_SECRET');

export const env = Object.freeze({
  NODE_ENV: nodeEnv,
  PORT: parsePositiveInt('PORT', 4000),
  DATABASE_URL: requireString('DATABASE_URL'),
  ENABLE_BACKGROUND_JOBS: parseBoolean(
    'ENABLE_BACKGROUND_JOBS',
    nodeEnv !== 'test',
  ),
  FRONTEND_ORIGIN: requireString('FRONTEND_ORIGIN', 'http://localhost:3000'),
  FRONTEND_APP_URL: requireString('FRONTEND_APP_URL', 'http://localhost:3000'),
  SESSION_COOKIE_NAME: requireString('SESSION_COOKIE_NAME', 'ims_session'),
  SESSION_TOKEN_SECRET: sessionTokenSecret,
  RESET_TOKEN_SECRET: requireString('RESET_TOKEN_SECRET', sessionTokenSecret),
  AUTH_COOKIE_SECURE: parseBoolean(
    'AUTH_COOKIE_SECURE',
    nodeEnv === 'production',
  ),
  AUTH_COOKIE_SAME_SITE: parseSameSite('AUTH_COOKIE_SAME_SITE', 'lax'),
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN?.trim() || undefined,
  SESSION_TTL_HOURS: parsePositiveInt('SESSION_TTL_HOURS', 24),
  SESSION_IDLE_TTL_HOURS: parsePositiveInt('SESSION_IDLE_TTL_HOURS', 8),
  PASSWORD_RESET_TTL_MINUTES: parsePositiveInt(
    'PASSWORD_RESET_TTL_MINUTES',
    30,
  ),
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES: parsePositiveInt(
    'PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES',
    15,
  ),
  PASSWORD_RESET_REQUEST_MAX_ATTEMPTS: parsePositiveInt(
    'PASSWORD_RESET_REQUEST_MAX_ATTEMPTS',
    5,
  ),
  PASSWORD_RESET_CONFIRM_MAX_ATTEMPTS: parsePositiveInt(
    'PASSWORD_RESET_CONFIRM_MAX_ATTEMPTS',
    10,
  ),
  LOGIN_MAX_ATTEMPTS: parsePositiveInt('LOGIN_MAX_ATTEMPTS', 5),
  LOGIN_LOCK_MINUTES: parsePositiveInt('LOGIN_LOCK_MINUTES', 15),
  EXPOSE_RESET_TOKEN_IN_DEV: parseBoolean('EXPOSE_RESET_TOKEN_IN_DEV', false),
});

export function isBackgroundJobsEnabled(): boolean {
  return readBooleanEnv('ENABLE_BACKGROUND_JOBS', env.NODE_ENV !== 'test');
}
