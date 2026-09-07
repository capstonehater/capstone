import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { env } from '../config/env.validation';
import {
  PASSWORD_RESET_RATE_LIMIT_MESSAGE,
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
} from './auth.constants';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthThrottleService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consumeForgotPasswordAttempt(ipAddress?: string | null): void {
    this.consume({
      key: `forgot-password:${ipAddress ?? 'unknown'}`,
      maxAttempts: env.PASSWORD_RESET_REQUEST_MAX_ATTEMPTS,
    });
  }

  consumeResetPasswordAttempt(ipAddress?: string | null): void {
    this.consume({
      key: `reset-password:${ipAddress ?? 'unknown'}`,
      maxAttempts: env.PASSWORD_RESET_CONFIRM_MAX_ATTEMPTS,
    });
  }

  private consume(options: { key: string; maxAttempts: number }): void {
    const now = Date.now();
    const current = this.buckets.get(options.key);

    if (!current || current.resetAt <= now) {
      this.buckets.set(options.key, {
        count: 1,
        resetAt: now + PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
      });
      this.pruneExpiredBuckets(now);
      return;
    }

    if (current.count >= options.maxAttempts) {
      throw new HttpException(
        PASSWORD_RESET_RATE_LIMIT_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    current.count += 1;
    this.buckets.set(options.key, current);
  }

  private pruneExpiredBuckets(now: number): void {
    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
