import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { defer, finalize, Observable, of, tap } from 'rxjs';
import type { Request, Response } from 'express';
import { CACHE_READ } from './cache-read.decorator';
import { ReadCacheService } from './read-cache.service';

@Injectable()
export class ReadCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: ReadCacheService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { id: string } }>();
    const response = http.getResponse<Response>();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return defer(() => {
        const finish = this.cache.beginWrite();
        return defer(() => next.handle()).pipe(finalize(finish));
      });
    }
    const ttl = this.reflector.getAllAndOverride<number>(CACHE_READ, [
      context.getHandler(),
      context.getClass(),
    ]);
    // Guards still run on every request, including cache hits. Never cache an
    // anonymous response, auth/session endpoint, or a route without opt-in.
    if (
      request.method !== 'GET' ||
      !ttl ||
      !request.user?.id ||
      !this.cache.available
    )
      return next.handle();
    const key = createHash('sha256')
      .update(
        JSON.stringify([
          context.getClass().name,
          context.getHandler().name,
          request.user.id,
          request.originalUrl,
        ]),
      )
      .digest('hex');
    const cached = this.cache.get(key);
    if (cached !== undefined) return of(cached);
    const revision = this.cache.revision;
    return next.handle().pipe(
      tap((value) => {
        if (response.statusCode === 200 && !response.getHeader('Set-Cookie')) {
          this.cache.set(key, value, ttl, revision);
        }
      }),
    );
  }
}
