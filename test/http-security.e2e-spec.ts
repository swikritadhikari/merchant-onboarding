import { JwtService } from '@nestjs/jwt';
import { ShutdownStateService } from '../src/common/lifecycle';
import { Role } from '../src/modules/users/enums';
import { TestApp } from './support/test-app';

const ALLOWED_ORIGIN = 'https://app.example.test';

describe('HTTP security and health (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  beforeEach(() => t.reset());

  afterAll(() => t.close());

  describe('routing', () => {
    it('serves the API only under /api/v1', async () => {
      await t.http.get('/api/v1/applications').expect(401);
      await t.http.get('/applications').expect(404);
      await t.http.get('/api/v2/applications').expect(404);
    });

    it('keeps health probes stable outside the versioned prefix', async () => {
      await t.http.get('/health/live').expect(200);
      await t.http.get('/api/v1/health/live').expect(404);
    });
  });

  describe('CORS', () => {
    it('answers a preflight from an allowed origin', async () => {
      const res = await t.http
        .options('/api/v1/applications')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization,content-type')
        .expect(204);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
      expect(res.headers['access-control-allow-headers']).toMatch(/authorization/i);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('does not grant access to other origins', async () => {
      const res = await t.http.get('/health/live').set('Origin', 'https://evil.example.test');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('exposes the request id header to browsers', async () => {
      const res = await t.http.get('/health/live').set('Origin', ALLOWED_ORIGIN);
      expect(res.headers['access-control-expose-headers']).toMatch(/x-request-id/i);
    });
  });

  it('sends hardened security headers', async () => {
    const res = await t.http.get('/health/live').expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('rejects tokens minted for another audience or issuer', async () => {
    const user = await t.createUser(Role.Sales, { login: false });
    const jwt = t.get(JwtService);
    const claims = { sub: user.id, role: Role.Sales, sid: user.id, jti: user.id };

    const otherAudience = await jwt.signAsync(claims, { audience: 'someone-else' });
    const otherIssuer = await jwt.signAsync(claims, { issuer: 'another-service' });

    await t.http.get('/api/v1/auth/me').set('Authorization', `Bearer ${otherAudience}`).expect(401);
    await t.http.get('/api/v1/auth/me').set('Authorization', `Bearer ${otherIssuer}`).expect(401);
  });

  describe('health probes', () => {
    it('reports liveness', async () => {
      await t.http.get('/health/live').expect(200, { status: 'ok' });
    });

    it('reports readiness with dependency checks', async () => {
      const res = await t.http.get('/health/ready').expect(200);
      expect(res.body).toEqual({
        status: 'ok',
        checks: { database: 'up', redis: 'up', shuttingDown: false },
      });
    });

    it('stops reporting ready once shutdown has started', async () => {
      t.get(ShutdownStateService).begin();

      const res = await t.http.get('/health/ready').expect(503);
      expect(res.body).toMatchObject({ status: 'unavailable', checks: { shuttingDown: true } });
      await t.http.get('/health/live').expect(200);
    });
  });
});
