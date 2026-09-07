import { CookieOptions } from 'express';
import { env } from '../config/env.validation';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
export const LOGIN_LOCKED_MESSAGE =
  'Too many login attempts. Please try again later.';
export const LOGOUT_SUCCESS_MESSAGE = 'Logout successful';
export const FORGOT_PASSWORD_MESSAGE =
  'If an account exists for that email, a password reset link will be sent.';
export const RESET_PASSWORD_SUCCESS_MESSAGE = 'Password reset successful';
export const PASSWORD_RESET_RATE_LIMIT_MESSAGE =
  'Too many password reset attempts. Please try again later.';
export const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
export const SESSION_IDLE_TTL_MS = env.SESSION_IDLE_TTL_HOURS * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000;
export const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS =
  env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 72;
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: env.AUTH_COOKIE_SECURE,
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
};
