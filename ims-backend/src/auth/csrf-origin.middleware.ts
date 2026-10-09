import { NextFunction, Request, Response } from 'express';
import { frontendOrigins } from './frontend-origins';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return null;
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

  const allowedOrigins = frontendOrigins();
  const origin = firstHeaderValue(request.headers.origin);
  const referer = firstHeaderValue(request.headers.referer);

  if (origin) {
    if (allowedOrigins.includes(origin)) {
      next();
      return;
    }

    response.status(403).json({ message: 'Cross-site request blocked' });
    return;
  }

  if (referer) {
    const refererOrigin = originFromReferer(referer);
    if (refererOrigin && allowedOrigins.includes(refererOrigin)) {
      next();
      return;
    }

    response.status(403).json({ message: 'Cross-site request blocked' });
    return;
  }

  response.status(403).json({ message: 'Request origin required' });
}
