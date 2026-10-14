import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { env } from '../config/env.validation';
import { ReadCacheService } from './read-cache.service';
import { ReadCacheInterceptor } from './read-cache.interceptor';

describe('bounded read cache', () => {
  let cache: ReadCacheService;
  beforeEach(() => {
    cache = new ReadCacheService();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('expires values and isolates returned objects using JSON wire semantics', () => {
    cache.set(
      'a',
      { date: new Date('2026-01-01'), nested: { count: 1 } },
      100,
      cache.revision,
    );
    const first = cache.get('a') as { date: string; nested: { count: number } };
    expect(first.date).toBe('2026-01-01T00:00:00.000Z');
    first.nested.count = 99;
    expect(cache.get('a')).toMatchObject({ nested: { count: 1 } });
    jest.advanceTimersByTime(100);
    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts least recently used entries at the entry limit', () => {
    for (let i = 0; i < env.READ_CACHE_MAX_ENTRIES; i++)
      cache.set(String(i), i, 1000, cache.revision);
    cache.get('0');
    cache.set('extra', true, 1000, cache.revision);
    expect(cache.get('0')).toBe(0);
    expect(cache.get('1')).toBeUndefined();
  });

  it('enforces the total byte budget as well as the entry limit', () => {
    const payload = 'x'.repeat(
      Math.min(
        env.READ_CACHE_MAX_ENTRY_BYTES - 100,
        env.READ_CACHE_MAX_BYTES / 2,
      ),
    );
    const count =
      Math.floor(
        env.READ_CACHE_MAX_BYTES / Buffer.byteLength(JSON.stringify(payload)),
      ) + 2;
    for (let i = 0; i < count; i++)
      cache.set(String(i), payload, 1000, cache.revision);
    expect(cache.get('0')).toBeUndefined();
    expect(cache.get(String(count - 1))).toBe(payload);
  });

  it('bypasses oversized or unserializable results without throwing', () => {
    expect(() => cache.set('bigint', 1n, 1000, cache.revision)).not.toThrow();
    cache.set(
      'large',
      'x'.repeat(env.READ_CACHE_MAX_ENTRY_BYTES),
      1000,
      cache.revision,
    );
    expect(cache.get('large')).toBeUndefined();
    expect(cache.get('bigint')).toBeUndefined();
  });

  it('blocks reads and fills during overlapping writes, and rejects old fills', () => {
    const revision = cache.revision;
    cache.set('a', 1, 1000, revision);
    const endFirst = cache.beginWrite();
    const endSecond = cache.beginWrite();
    expect(cache.get('a')).toBeUndefined();
    endFirst();
    endFirst(); // Cleanup is idempotent.
    expect(cache.available).toBe(false);
    endSecond();
    cache.set('old', 1, 1000, revision);
    expect(cache.get('old')).toBeUndefined();
    cache.set('new', 2, 1000, cache.revision);
    expect(cache.get('new')).toBe(2);
  });
});

describe('read cache interceptor', () => {
  let cache: ReadCacheService;
  let interceptor: ReadCacheInterceptor;
  let ttl: number | undefined;
  let request: { method: string; user?: { id: string }; originalUrl: string };
  let response: { statusCode: number; getHeader: jest.Mock };
  let context: ExecutionContext;
  let next: { handle: jest.Mock };
  beforeEach(() => {
    cache = new ReadCacheService();
    ttl = 1000;
    const reflector = { getAllAndOverride: () => ttl } as unknown as Reflector;
    interceptor = new ReadCacheInterceptor(reflector, cache);
    request = {
      method: 'GET',
      user: { id: 'u1' },
      originalUrl: '/reports/sales?days=7',
    };
    response = { statusCode: 200, getHeader: jest.fn() };
    class TestController {}
    function handler() {}
    context = {
      getType: () => 'http',
      getClass: () => TestController,
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    next = { handle: jest.fn(() => of({ total: 12 })) };
  });
  const read = () => firstValueFrom(interceptor.intercept(context, next));

  it('reuses reads only for the same user and URL including filters', async () => {
    await read();
    await read();
    expect(next.handle).toHaveBeenCalledTimes(1);
    request.user = { id: 'u2' };
    await read();
    request.originalUrl = '/reports/sales?days=30';
    await read();
    expect(next.handle).toHaveBeenCalledTimes(3);
  });

  it('does not cache anonymous, unmarked or explicitly excluded routes', async () => {
    request.user = undefined;
    await read();
    await read();
    request.user = { id: 'u1' };
    ttl = undefined;
    await read();
    await read();
    ttl = 0;
    await read();
    await read();
    expect(next.handle).toHaveBeenCalledTimes(6);
  });

  it('does not cache errors, non-200 responses, or cookie-setting responses', async () => {
    next.handle = jest.fn(() =>
      throwError(() => new Error('database unavailable')),
    );
    await expect(read()).rejects.toThrow('database unavailable');
    next.handle = jest.fn(() => of({ total: 12 }));
    response.statusCode = 202;
    await read();
    await read();
    response.statusCode = 200;
    response.getHeader.mockReturnValue('cookie');
    await read();
    await read();
    response.getHeader.mockReturnValue(undefined);
    await read();
    await read();
    expect(next.handle).toHaveBeenCalledTimes(5);
  });

  it('invalidates on successful and failed mutations', async () => {
    await read();
    request.method = 'PATCH';
    await read();
    request.method = 'GET';
    await read();
    expect(next.handle).toHaveBeenCalledTimes(3);
    request.method = 'POST';
    next.handle = jest.fn(() => throwError(() => new Error('write failed')));
    await expect(read()).rejects.toThrow('write failed');
    expect(cache.available).toBe(true);
    request.method = 'GET';
    next.handle = jest.fn(() => of({ total: 13 }));
    expect(await read()).toEqual({ total: 13 });
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('does not let a read begun before a mutation refill the cache', async () => {
    const slowRead = new Subject<unknown>();
    next.handle = jest.fn(() => slowRead);
    const pending = read();
    const finish = cache.beginWrite();
    finish();
    slowRead.next({ total: 1 });
    slowRead.complete();
    await pending;
    next.handle = jest.fn(() => of({ total: 2 }));
    expect(await read()).toEqual({ total: 2 });
  });
});
