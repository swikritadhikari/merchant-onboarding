import { LOGIN_LIMIT, GLOBAL_LIMIT } from './support/rate-limit-env';
import { CACHE_REDIS_CLIENT } from '../src/common/cache';
import { Role } from '../src/modules/users/enums';
import { TestApp } from './support/test-app';
import { type Redis } from 'ioredis';

describe('Rate limiting (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  beforeEach(() => t.reset());

  afterAll(() => t.close());

  const attemptLogin = (email: string) =>
    t.http.post('/api/v1/auth/login').send({ email, password: 'not-the-password' });

  it('limits login attempts per client and tells the client when to retry', async () => {
    const user = await t.createUser(Role.Sales, { login: false });

    for (let i = 0; i < LOGIN_LIMIT; i++) {
      await attemptLogin(user.email).expect(401);
    }
    const blocked = await attemptLogin(user.email).expect(429);

    expect(blocked.body).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests, please retry later',
    });
    expect(Object.keys(blocked.headers).some((h) => h.startsWith('retry-after'))).toBe(true);
  });

  it('applies a global per-client limit to every other route', async () => {
    for (let i = 0; i < GLOBAL_LIMIT; i++) {
      await t.http.get('/api/v1/applications').expect(401);
    }
    const blocked = await t.http.get('/api/v1/applications').expect(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
  });

  it('never throttles health probes', async () => {
    for (let i = 0; i < GLOBAL_LIMIT * 2; i++) {
      await t.http.get('/health/live').expect(200);
    }
  });

  it('keeps counters in Redis so limits hold across instances', async () => {
    await t.http.get('/api/v1/applications').expect(401);

    const redis = t.app.get<Redis>(CACHE_REDIS_CLIENT);
    const keys = await redis.keys(`${redis.options.keyPrefix ?? ''}throttle:*`);
    expect(keys.length).toBeGreaterThan(0);
  });
});
