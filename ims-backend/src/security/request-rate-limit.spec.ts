import express from 'express';
import request from 'supertest';
import { createRequestRateLimit } from './request-rate-limit';

describe('request flood protection', () => {
  let time: number;
  const defaults = {
    burst: 30,
    perMinute: 300,
    globalPerSecond: 500,
    maxClients: 10_000,
  };
  beforeEach(() => {
    time = 0;
  });

  function app(options = defaults, trustProxy = false) {
    const server = express();
    server.set('trust proxy', trustProxy ? ['loopback'] : false);
    server.use(createRequestRateLimit(options, () => time));
    server.use(express.json());
    server.use((_req, res) => {
      res.json({ ok: true });
    });
    return server;
  }

  it('rejects 9,970 of a frozen-time 10,000-request burst before downstream work', () => {
    const middleware = createRequestRateLimit(defaults, () => time);
    let accepted = 0;
    let rejected = 0;
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: () => {
        rejected += 1;
      },
    };
    for (let i = 0; i < 10_000; i += 1) {
      middleware(
        { ip: '192.0.2.1' } as Parameters<typeof middleware>[0],
        response as unknown as Parameters<typeof middleware>[1],
        () => {
          accepted += 1;
        },
      );
    }
    expect(accepted).toBe(30);
    expect(rejected).toBe(9970);
    expect(response.status).toHaveBeenCalledWith(429);
  });

  it('returns retry guidance, limits all paths and ignores spoofed forwarding headers', async () => {
    const server = app({ ...defaults, burst: 1 });
    await request(server).get('/one').expect(200);
    const blocked = await request(server)
      .post('/other')
      .set('X-Forwarded-For', '192.0.2.99')
      .send('{invalid json')
      .set('Content-Type', 'application/json');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBe('1');
    time = 1000;
    await request(server).get('/one').expect(200);
  });

  it('enforces the sustained budget even when requests avoid the burst limit', async () => {
    const server = app({ ...defaults, burst: 100, perMinute: 2 });
    await request(server).get('/').expect(200);
    time = 1000;
    await request(server).get('/').expect(200);
    time = 2000;
    const blocked = await request(server).get('/');
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBe('28');
    time = 30_000;
    await request(server).get('/').expect(200);
  });

  it('caps distributed traffic and refills the global budget', async () => {
    const server = app({ ...defaults, globalPerSecond: 2 }, true);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.0.2.1')
      .expect(200);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.0.2.2')
      .expect(200);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.0.2.3')
      .expect(429);
    time = 1000;
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.0.2.3')
      .expect(200);
  });

  it('bounds client storage without resetting active budgets and reclaims idle entries', async () => {
    const server = app({ ...defaults, maxClients: 1, burst: 1 }, true);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.0.2.1')
      .expect(200);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.0.2.2')
      .expect(429);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.0.2.1')
      .expect(429);
    time = 60_000;
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '192.0.2.2')
      .expect(200);
  });

  it('shares a budget between IPv6 addresses in the same /64', async () => {
    const server = app({ ...defaults, burst: 1 }, true);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '2001:db8:abcd:12::1')
      .expect(200);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '2001:0db8:abcd:0012:0:0:0:2')
      .expect(429);
    await request(server)
      .get('/')
      .set('X-Forwarded-For', '2001:db8:abcd:13::1')
      .expect(200);
  });
});
