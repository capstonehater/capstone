import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.validation';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function originFromReferer(referer: string): string | null {
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function csrfOriginMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    next();
    return;
  }

  const allowedOrigin = env.FRONTEND_ORIGIN;
  const origin = firstHeaderValue(request.headers.origin);
  const referer = firstHeaderValue(request.headers.referer);

  if (origin) {
    if (origin === allowedOrigin) {
      next();
      return;
    }

    response.status(403).json({ message: 'Cross-site request blocked' });
    return;
  }

  if (referer) {
    if (originFromReferer(referer) === allowedOrigin) {
      next();
      return;
    }

    response.status(403).json({ message: 'Cross-site request blocked' });
    return;
  }

  next();
}
