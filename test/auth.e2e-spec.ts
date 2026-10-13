import { Role } from '../src/modules/users/enums';
import { CacheService } from '../src/common/cache';
import { UsersService } from '../src/modules/users/users.service';
import { auth, TestApp } from './support/test-app';

describe('Authentication (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await TestApp.create();
  });
  beforeEach(() => t.reset());
  afterAll(() => t.close());

  it('issues a bearer token for valid credentials', async () => {
    await t.get(UsersService).create({
      email: 'Login.User@Example.test',
      password: 'correct horse battery',
      role: Role.Sales,
      fullName: 'Login User',
    });

    const res = await t.http
      .post('/api/v1/auth/login')
      .send({ email: 'login.user@example.test', password: 'correct horse battery' })
      .expect(200);

    expect(res.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 900,
      refreshToken: expect.any(String),
      refreshExpiresIn: expect.any(Number),
    });
    await t.http
      .get('/api/v1/auth/me')
      .set({ Authorization: `Bearer ${res.body.accessToken}` })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ role: Role.Sales });
      });
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const user = await t.createUser(Role.Sales, { login: false });

    const wrongPassword = await t.http
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'not-the-password' })
      .expect(401);
    const unknownUser = await t.http
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.test', password: 'whatever' })
      .expect(401);

    expect(wrongPassword.body.message).toBe(unknownUser.body.message);
  });

  it('validates the login payload', async () => {
    await t.http.post('/api/v1/auth/login').send({ email: 'not-an-email' }).expect(400);
  });

  it.each([
    ['no token', {}],
    ['a malformed token', { Authorization: 'Bearer not-a-jwt' }],
    [
      'a token signed with another key',
      {
        Authorization:
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6IkFETUlOIn0.' +
          'c2lnbmF0dXJlLWZyb20tYW5vdGhlci1rZXk',
      },
    ],
  ])('rejects protected routes with %s', async (_label, headers) => {
    await t.http.get('/api/v1/applications').set(headers).expect(401);
  });

  it('rejects an alg=none token that claims to be ADMIN', async () => {
    const admin = await t.createUser(Role.Admin, { login: false });
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: admin.id, role: 'ADMIN' })}.`;

    await t.http
      .get('/api/v1/users')
      .set({ Authorization: `Bearer ${forged}` })
      .expect(401);
  });

  it('stops honouring a token as soon as an admin deactivates the user', async () => {
    const admin = await t.createUser(Role.Admin);
    const user = await t.createUser(Role.Sales);
    await t.http.get('/api/v1/applications').set(auth(user)).expect(200);

    await t.http
      .patch(`/api/v1/users/${user.id}`)
      .set(auth(admin))
      .send({ isActive: false })
      .expect(200);

    await t.http.get('/api/v1/applications').set(auth(user)).expect(401);
  });

  it('applies a role change immediately, ignoring the role baked into the token', async () => {
    const admin = await t.createUser(Role.Admin);
    const user = await t.createUser(Role.Admin);
    await t.http.get('/api/v1/users').set(auth(user)).expect(200);

    await t.http
      .patch(`/api/v1/users/${user.id}`)
      .set(auth(admin))
      .send({ role: Role.Sales })
      .expect(200);

    await t.http.get('/api/v1/users').set(auth(user)).expect(403);
  });

  it('serves the authenticated principal from cache between changes', async () => {
    const admin = await t.createUser(Role.Admin);
    await t.http.get('/api/v1/users').set(auth(admin)).expect(200);
    const before = t.get(CacheService).stats.hit;

    await t.dataSource.query(`UPDATE users SET role = 'SALES' WHERE id = $1`, [admin.id]);
    await t.http.get('/api/v1/users').set(auth(admin)).expect(200);

    expect(t.get(CacheService).stats.hit).toBeGreaterThan(before);
  });

  it('marks every API response as non-cacheable', async () => {
    const res = await t.http
      .post('/api/v1/auth/login')
      .send({ email: 'x@example.test', password: 'x' });
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
