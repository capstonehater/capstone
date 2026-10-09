import { env } from '../config/env.validation';

// Exact configured origins only; never trust a request's Host or forwarded headers.
export function frontendOrigins(): string[] {
  return [env.FRONTEND_ORIGIN, ...(env.ADDITIONAL_FRONTEND_ORIGINS ?? '').split(',')]
    .map((origin) => origin.trim())
    .filter(Boolean);
}
