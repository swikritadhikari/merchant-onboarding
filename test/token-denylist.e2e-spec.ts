import { JwtService } from '@nestjs/jwt';
import { type Redis } from 'ioredis';
import { CACHE_REDIS_CLIENT } from '../src/common/cache';
import { Role } from '../src/modules/users/enums';
import { UsersService } from '../src/modules/users/users.service';
import { TestApp } from './support/test-app';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

describe('Access token denylist (e2e)', () => {
  let t: TestApp;
  let email: string;
  let userId: string;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    t = await TestApp.create();
  });

  beforeEach(async () => {
    await t.reset();
    email = `denylist.${Date.now()}@example.test`;
    userId = (
      await t.get(UsersService).create({ email, password, role: Role.Sales, fullName: 'Deny User' })
    ).id;
  });

  afterAll(() => t.close());

  const login = async (): Promise<TokenPair> =>
    (await t.http.post('/api/v1/auth/login').send({ email, password }).expect(200))
      .body as TokenPair;

  const me = (accessToken: string) =>
    t.http.get('/api/v1/auth/me').set({ Authorization: `Bearer ${accessToken}` });

  const sessionIdOf = (accessToken: string) =>
    t.get(JwtService).decode<{ sid: string; jti: string }>(accessToken).sid;

  it('puts a session id and a unique token id in every access token', async () => {
    const { accessToken, refreshToken } = await login();
    const refreshed = (await t.http.post('/api/v1/auth/refresh').send({ refreshToken }).expect(200))
      .body as TokenPair;

    const first = t.get(JwtService).decode<{ sid: string; jti: string }>(accessToken);
    const second = t.get(JwtService).decode<{ sid: string; jti: string }>(refreshed.accessToken);
    expect(first.sid).toBe(second.sid);
    expect(first.jti).not.toBe(second.jti);
  });

  it('logout invalidates the session’s access tokens immediately, including older ones', async () => {
    const first = await login();
    const second = (
      await t.http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first.refreshToken })
        .expect(200)
    ).body as TokenPair;
    await me(first.accessToken).expect(200);

    await t.http
      .post('/api/v1/auth/logout')
      .send({ refreshToken: second.refreshToken })
      .expect(204);

    await me(first.accessToken).expect(401);
    await me(second.accessToken).expect(401);
  });

  it('does not affect the user’s other sessions', async () => {
    const laptop = await login();
    const phone = await login();

    await t.http
      .post('/api/v1/auth/logout')
      .send({ refreshToken: laptop.refreshToken })
      .expect(204);

    await me(laptop.accessToken).expect(401);
    await me(phone.accessToken).expect(200);
  });

  it('kills the access tokens of a session when refresh-token reuse is detected', async () => {
    const victim = await login();
    const attacker = (
      await t.http
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: victim.refreshToken })
        .expect(200)
    ).body as TokenPair;
    await me(attacker.accessToken).expect(200);

    await t.http
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: victim.refreshToken })
      .expect(401);

    await me(attacker.accessToken).expect(401);
    await me(victim.accessToken).expect(401);
  });

  it('logout-all signs the user out of every session at once', async () => {
    const laptop = await login();
    const phone = await login();

    await t.http
      .post('/api/v1/auth/logout-all')
      .set({ Authorization: `Bearer ${phone.accessToken}` })
      .expect(204);

    await me(laptop.accessToken).expect(401);
    await me(phone.accessToken).expect(401);
    await t.http
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: laptop.refreshToken })
      .expect(401);
    await t.http
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: phone.refreshToken })
      .expect(401);
  });

  it('requires authentication for logout-all', async () => {
    await t.http.post('/api/v1/auth/logout-all').expect(401);
  });

  it('expires denylist entries together with the access tokens they block', async () => {
    const { accessToken, refreshToken } = await login();
    await t.http.post('/api/v1/auth/logout').send({ refreshToken }).expect(204);

    const redis = t.app.get<Redis>(CACHE_REDIS_CLIENT);
    const ttl = await redis.ttl(`denylist:session:${sessionIdOf(accessToken)}`);
    expect(ttl).toBeGreaterThan(900);
    expect(ttl).toBeLessThanOrEqual(960);
  });

  it('rejects a correctly signed token that carries no session id', async () => {
    const legacy = await t.get(JwtService).signAsync({ sub: userId, role: Role.Sales });
    await me(legacy).expect(401);
  });
});
