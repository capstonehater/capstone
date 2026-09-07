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

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=');

    if (key === cookieName) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

export function readSessionTokenFromRequest(request: Request): string | null {
  return readCookieValue(request.headers.cookie, env.SESSION_COOKIE_NAME);
}

export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0]?.split(',')[0].trim() ?? null;
  }

  return request.ip ?? null;
}

export function getUserAgent(request: Request): string | null {
  const userAgent = request.headers['user-agent'];

  if (typeof userAgent === 'string') {
    return userAgent;
  }

  return userAgent?.[0] ?? null;
}
