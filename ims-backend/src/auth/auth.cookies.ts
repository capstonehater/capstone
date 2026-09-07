import { Response } from 'express';
import { env } from '../config/env.validation';
import { AUTH_COOKIE_OPTIONS } from './auth.constants';

export function setAuthCookie(
  response: Response,
  sessionToken: string,
  expiresAt: Date,
): void {
  response.cookie(env.SESSION_COOKIE_NAME, sessionToken, {
    ...AUTH_COOKIE_OPTIONS,
    expires: expiresAt,
  });
}

export function clearAuthCookie(response: Response): void {
  response.clearCookie(env.SESSION_COOKIE_NAME, AUTH_COOKIE_OPTIONS);
}
