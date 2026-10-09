import type { Request } from 'express';
import express = require('express');
import request = require('supertest');
import { csrfOriginMiddleware } from './csrf-origin.middleware';
import { getClientIp, readCookieValue } from './auth.utils';
import { AuthThrottleService } from './auth-throttle.service';
import { Prisma } from '@prisma/client';
import { FEFOAllocator } from '../inventory/fefo-allocator.service';

jest.mock('../config/env.validation', () => ({
  env: {
    FRONTEND_ORIGIN: 'http://localhost:3000',
    ADDITIONAL_FRONTEND_ORIGINS: 'https://ims.example.com',
    LOGIN_IP_MAX_ATTEMPTS: 2,
    PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES: 15,
  },
}));

describe('security boundaries', () => {
  const app = express();
  app.use(csrfOriginMiddleware);
  app.post('/change', (_req, res) => {
    res.sendStatus(204);
  });
  app.get('/read', (_req, res) => {
    res.sendStatus(204);
  });
  it('rejects missing, null, and attacker origins on writes', async () => {
    await request(app).post('/change').expect(403);
    for (const origin of [
      'null',
      'https://evil.example',
      'http://localhost:3000.evil.example',
      'https://ims.example.com.evil.example',
    ]) {
      await request(app).post('/change').set('Origin', origin).expect(403);
    }
  });
  it('allows configured origin and referer fallback but does not override a bad origin', async () => {
    await request(app)
      .post('/change')
      .set('Origin', 'http://localhost:3000')
      .expect(204);
    await request(app)
      .post('/change')
      .set('Referer', 'http://localhost:3000/account')
      .expect(204);
    await request(app)
      .post('/change')
      .set('Origin', 'null')
      .set('Referer', 'http://localhost:3000/')
      .expect(403);
    await request(app).get('/read').expect(204);
  });
  it('allows the additional configured frontend origin for writes', async () => {
    await request(app).post('/change').set('Origin', 'https://ims.example.com').expect(204);
    await request(app).post('/change').set('Referer', 'https://ims.example.com/account').expect(204);
  });
  it('rejects malformed and ambiguous cookies', () => {
    expect(readCookieValue('session=%ZZ', 'session')).toBeNull();
    expect(readCookieValue('session=one; session=two', 'session')).toBeNull();
    expect(readCookieValue('other=one; session=valid%3Dtoken', 'session')).toBe(
      'valid=token',
    );
  });
  it('uses Express resolved IP rather than attacker supplied forwarding headers', () => {
    expect(
      getClientIp({
        ip: '192.0.2.10',
        headers: { 'x-forwarded-for': 'attacker' },
      } as unknown as Request),
    ).toBe('192.0.2.10');
  });
  it('enforces the login IP limit and releases expired buckets', () => {
    const service = new AuthThrottleService();
    const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      service.consumeLoginAttempt('192.0.2.10');
      service.consumeLoginAttempt('192.0.2.10');
      expect(() => service.consumeLoginAttempt('192.0.2.10')).toThrow(
        'Too many login attempts',
      );
      expect(() => service.consumeLoginAttempt('192.0.2.11')).not.toThrow();
      now.mockReturnValue(1000 + 15 * 60 * 1000);
      expect(() => service.consumeLoginAttempt('192.0.2.10')).not.toThrow();
    } finally {
      now.mockRestore();
    }
  });
  it('binds SQL injection text as a value in the stock allocation query', async () => {
    const payload = "x') OR 1=1; DROP TABLE stock_batches; --";
    const query = jest.fn().mockResolvedValue([]);
    const allocator = new FEFOAllocator({} as any);
    await expect(
      allocator.allocateAndConsume({ $queryRaw: query } as any, [
        { rawMaterialId: payload, quantity: new Prisma.Decimal(1) },
      ]),
    ).rejects.toThrow('Insufficient stock');
    const sql = query.mock.calls[0][0] as Prisma.Sql;
    expect(sql.values).toContain(payload);
    expect(sql.text).not.toContain(payload);
    expect(sql.text).toContain('$1');
  });
});
