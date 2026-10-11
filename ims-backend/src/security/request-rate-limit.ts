import type { RequestHandler } from 'express';

export type RequestRateLimitOptions = {
  burst: number;
  perMinute: number;
  globalPerSecond: number;
  maxClients: number;
};

type Bucket = { burst: number; sustained: number; updatedAt: number };

// Group IPv6 clients by /64 so rotating addresses within a subnet cannot
// create unlimited independent budgets. Express supplies the trusted client IP.
function clientKey(ip: string): string {
  if (ip.startsWith('::ffff:') && ip.includes('.')) return ip.slice(7);
  if (!ip.includes(':')) return ip;
  const [left, right = ''] = ip.toLowerCase().split('::');
  const head = left ? left.split(':') : [];
  const tail = right ? right.split(':') : [];
  const parts = ip.includes('::')
    ? [
        ...head,
        ...Array<string>(8 - head.length - tail.length).fill('0'),
        ...tail,
      ]
    : head;
  return parts
    .slice(0, 4)
    .map((part) => parseInt(part, 16).toString(16))
    .join(':');
}

export function createRequestRateLimit(
  options: RequestRateLimitOptions,
  now: () => number = Date.now,
): RequestHandler {
  for (const value of Object.values(options)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error('Request rate limits must be positive safe integers');
    }
  }
  const clients = new Map<string, Bucket>();
  let globalTokens = options.globalPerSecond;
  let globalUpdatedAt = now();
  let lastPrunedAt = globalUpdatedAt;

  return (request, response, next) => {
    const time = now();
    const reject = (seconds: number) => {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil(seconds))),
      );
      response.setHeader('Cache-Control', 'no-store');
      response.status(429).json({
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Too many requests. Please try again later.',
      });
    };

    globalTokens = Math.min(
      options.globalPerSecond,
      globalTokens +
        (Math.max(0, time - globalUpdatedAt) * options.globalPerSecond) / 1000,
    );
    globalUpdatedAt = time;
    if (globalTokens < 1)
      return reject((1 - globalTokens) / options.globalPerSecond);
    // Count even requests rejected by the per-client limiter in the global cap.
    globalTokens -= 1;

    if (time - lastPrunedAt >= 60_000) {
      for (const [key, bucket] of clients) {
        if (time - bucket.updatedAt >= 60_000) clients.delete(key);
      }
      lastPrunedAt = time;
    }
    const key = clientKey(
      request.ip ?? request.socket.remoteAddress ?? 'unknown',
    );
    let bucket = clients.get(key);
    if (!bucket) {
      // Fail closed rather than evicting active clients and resetting budgets.
      if (clients.size >= options.maxClients) return reject(60);
      bucket = {
        burst: options.burst,
        sustained: options.perMinute,
        updatedAt: time,
      };
      clients.set(key, bucket);
    }
    const elapsed = Math.max(0, time - bucket.updatedAt);
    bucket.burst = Math.min(
      options.burst,
      bucket.burst + (elapsed * options.burst) / 1000,
    );
    bucket.sustained = Math.min(
      options.perMinute,
      bucket.sustained + (elapsed * options.perMinute) / 60_000,
    );
    bucket.updatedAt = time;
    if (bucket.burst < 1 || bucket.sustained < 1) {
      return reject(
        Math.max(
          (1 - bucket.burst) / options.burst,
          ((1 - bucket.sustained) * 60) / options.perMinute,
        ),
      );
    }
    bucket.burst -= 1;
    bucket.sustained -= 1;
    next();
  };
}
