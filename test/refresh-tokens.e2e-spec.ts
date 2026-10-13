import { hashRefreshToken } from '../src/modules/auth/utils';
import { Role } from '../src/modules/users/enums';
import { UsersService } from '../src/modules/users/users.service';
import { TestApp } from './support/test-app';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshExpiresIn: number;
}

describe('Refresh tokens (e2e)', () => {
  let t: TestApp;
  let email: string;
  let userId: string;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    t = await TestApp.create();
  });

  beforeEach(async () => {
    await t.reset();
    email = `refresh.${Date.now()}@example.test`;
    const user = await t.get(UsersService).create({
      email,
      password,
      role: Role.Sales,
      fullName: 'Refresh User',
    });
    userId = user.id;
  });

  afterAll(() => t.close());

  const login = async (): Promise<TokenPair> =>
    (await t.http.post('/api/v1/auth/login').send({ email, password }).expect(200))
      .body as TokenPair;

  const refresh = (refreshToken: string) =>
    t.http.post('/api/v1/auth/refresh').send({ refreshToken });

  const tokenRows = () =>
    t.dataSource.query<{ token_hash: string; family_id: string; revoked_reason: string | null }[]>(
      'SELECT token_hash, family_id, revoked_reason FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at',
      [userId],
    );

  it('rotates: returns a new working pair and retires the old refresh token', async () => {
    const first = await login();
    expect(first.refreshExpiresIn).toBeGreaterThan(604000);

    const res = await refresh(first.refreshToken).expect(200);
    const second = res.body as TokenPair;

    expect(second.refreshToken).not.toBe(first.refreshToken);
    await t.http
      .get('/api/v1/auth/me')
      .set({ Authorization: `Bearer ${second.accessToken}` })
      .expect(200);

    const rows = await tokenRows();
    expect(rows.map((r) => r.revoked_reason)).toEqual(['ROTATED', null]);
    expect(new Set(rows.map((r) => r.family_id)).size).toBe(1);
  });

  it('can be refreshed repeatedly along the chain', async () => {
    let pair = await login();
    for (let i = 0; i < 3; i++) {
      pair = (await refresh(pair.refreshToken).expect(200)).body as TokenPair;
    }
    expect(await tokenRows()).toHaveLength(4);
  });

  it('treats reuse of a rotated token as theft and revokes the whole session', async () => {
    const first = await login();
    const second = (await refresh(first.refreshToken).expect(200)).body as TokenPair;

    const reuse = await refresh(first.refreshToken).expect(401);
    expect(reuse.body.message).toBe('Invalid refresh token');

    await refresh(second.refreshToken).expect(401);
    const reasons = (await tokenRows()).map((r) => r.revoked_reason);
    expect(reasons).toEqual(['ROTATED', 'REUSE_DETECTED']);
  });

  it('only lets one of two concurrent refreshes with the same token succeed', async () => {
    const { refreshToken } = await login();

    const results = await Promise.all([refresh(refreshToken), refresh(refreshToken)]);

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 401]);
  });

  it('does not affect other sessions of the same user', async () => {
    const laptop = await login();
    const phone = await login();

    await refresh(laptop.refreshToken).expect(200);
    await refresh(laptop.refreshToken).expect(401);

    await refresh(phone.refreshToken).expect(200);
  });

  it('rejects an expired refresh token', async () => {
    const { refreshToken } = await login();
    await t.dataSource.query(
      `UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hashRefreshToken(refreshToken)],
    );

    await refresh(refreshToken).expect(401);
  });

  it('rejects unknown tokens and validates the payload', async () => {
    await refresh('x'.repeat(43)).expect(401);
    await t.http.post('/api/v1/auth/refresh').send({}).expect(400);
  });

  it('stops refreshing once the user is deactivated', async () => {
    const { refreshToken } = await login();
    await t.dataSource.query('UPDATE users SET is_active = false WHERE id = $1', [userId]);

    await refresh(refreshToken).expect(401);
    expect((await tokenRows()).map((r) => r.revoked_reason)).toEqual(['USER_INACTIVE']);
  });

  it('logout revokes the session and always answers 204', async () => {
    const first = await login();
    const second = (await refresh(first.refreshToken).expect(200)).body as TokenPair;

    await t.http
      .post('/api/v1/auth/logout')
      .send({ refreshToken: second.refreshToken })
      .expect(204);
    await refresh(second.refreshToken).expect(401);

    await t.http
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'y'.repeat(43) })
      .expect(204);
  });

  it('stores only a hash of the refresh token', async () => {
    const { refreshToken } = await login();
    const rows = await tokenRows();

    expect(rows[0]?.token_hash).toBe(hashRefreshToken(refreshToken));
    expect(JSON.stringify(rows)).not.toContain(refreshToken);
  });

  it('does not accept a refresh token as an access token', async () => {
    const { refreshToken } = await login();
    await t.http
      .get('/api/v1/auth/me')
      .set({ Authorization: `Bearer ${refreshToken}` })
      .expect(401);
  });
});
