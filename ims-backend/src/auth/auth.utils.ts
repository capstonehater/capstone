import { Request } from 'express';
import { env } from '../config/env.validation';

export function readCookieValue(
  cookieHeader: string | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  let found: string | null = null;
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=');

    if (key === cookieName) {
      // Ambiguous or malformed credentials must fail authentication.
      if (found !== null) return null;
      try {
        found = decodeURIComponent(valueParts.join('='));
      } catch {
        return null;
      }
    }
  }

  return found;
}

export function readSessionTokenFromRequest(request: Request): string | null {
  return readCookieValue(request.headers.cookie, env.SESSION_COOKIE_NAME);
}

export function getClientIp(request: Request): string | null {
  // Express resolves this using the configured trusted proxy addresses.
  return request.ip ?? request.socket?.remoteAddress ?? null;
}

export function getUserAgent(request: Request): string | null {
  const userAgent = request.headers['user-agent'];

  if (typeof userAgent === 'string') {
    return userAgent;
  }

  return userAgent?.[0] ?? null;
}
