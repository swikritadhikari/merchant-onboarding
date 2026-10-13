import { QueryFailedError } from 'typeorm';
import { ApplicationsService } from '../src/modules/applications/applications.service';
import { Role } from '../src/modules/users/enums';
import { auth, TestApp, type TestUser } from './support/test-app';

const ANY_ID = '00000000-0000-4000-8000-000000000000';

describe('Error handling (e2e)', () => {
  let t: TestApp;
  let admin: TestUser;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  beforeEach(async () => {
    await t.reset();
    admin = await t.createUser(Role.Admin);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => t.close());

  const expectErrorShape = (body: Record<string, unknown>, status: number, code: string) => {
    expect(body).toMatchObject({
      statusCode: status,
      code,
      message: expect.any(String),
      path: expect.any(String),
      method: expect.any(String),
      requestId: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('debug');
  };

  it('rejects malformed JSON without leaking parser internals', async () => {
    const res = await t.http
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.c",')
      .expect(400);

    expectErrorShape(res.body, 400, 'BAD_REQUEST');
    expect(res.body.message).toBe('Request body is not valid JSON');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await t.http
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a'.repeat(200_000) }))
      .expect(413);
    expectErrorShape(res.body, 413, 'PAYLOAD_TOO_LARGE');
  });

  it('rejects non-JSON bodies with 415 instead of treating them as empty', async () => {
    const res = await t.http
      .post('/api/v1/auth/login')
      .set('Content-Type', 'text/plain')
      .send('email=a@b.c')
      .expect(415);
    expectErrorShape(res.body, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('answers unknown routes with the standard 404 shape', async () => {
    const res = await t.http.get('/api/v1/does-not-exist').expect(404);
    expectErrorShape(res.body, 404, 'NOT_FOUND');
  });

  it('reports an invalid id as a field-level validation error', async () => {
    const res = await t.http.get('/api/v1/applications/not-a-uuid').set(auth(admin)).expect(400);
    expectErrorShape(res.body, 400, 'VALIDATION_FAILED');
    expect(res.body.details).toEqual([{ field: 'id', messages: ['id must be a valid UUID'] }]);
  });

  it('returns structured, nested validation details', async () => {
    const sales = await t.createUser(Role.Sales);
    const res = await t.http
      .post('/api/v1/applications')
      .set(auth(sales))
      .send({ businessName: 'A', owner: { email: 'nope' }, unexpected: true })
      .expect(400);

    expectErrorShape(res.body, 400, 'VALIDATION_FAILED');
    const fields = (res.body.details as { field: string }[]).map((d) => d.field);
    expect(fields).toEqual(
      expect.arrayContaining(['businessName', 'owner.email', 'owner.phone', 'unexpected']),
    );
  });

  it('hides unexpected failures behind a generic 500', async () => {
    jest
      .spyOn(t.get(ApplicationsService), 'findOne')
      .mockRejectedValueOnce(new Error('connection string postgres://admin:hunter2@db'));

    const res = await t.http.get(`/api/v1/applications/${ANY_ID}`).set(auth(admin)).expect(500);

    expectErrorShape(res.body, 500, 'INTERNAL_ERROR');
    expect(res.body.message).toBe('An unexpected error occurred');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
  });

  it('turns a database outage into 503 with Retry-After', async () => {
    const outage = new QueryFailedError(
      'SELECT 1',
      [],
      Object.assign(new Error('terminating connection due to administrator command'), {
        code: '57P01',
      }),
    );
    jest.spyOn(t.get(ApplicationsService), 'findOne').mockRejectedValueOnce(outage);

    const res = await t.http.get(`/api/v1/applications/${ANY_ID}`).set(auth(admin)).expect(503);

    expectErrorShape(res.body, 503, 'SERVICE_UNAVAILABLE');
    expect(res.headers['retry-after']).toBe('1');
  });

  it('propagates a safe client request id and replaces an unsafe one', async () => {
    const kept = await t.http.get('/api/v1/does-not-exist').set('X-Request-Id', 'client-abc.123');
    expect(kept.headers['x-request-id']).toBe('client-abc.123');
    expect(kept.body.requestId).toBe('client-abc.123');

    const replaced = await t.http
      .get('/api/v1/does-not-exist')
      .set('X-Request-Id', 'bad id\twith spaces');
    expect(replaced.headers['x-request-id']).not.toContain(' ');
    expect(replaced.body.requestId).toBe(replaced.headers['x-request-id']);
  });

  it('uses the same shape for domain errors', async () => {
    const res = await t.http.get(`/api/v1/applications/${ANY_ID}`).set(auth(admin)).expect(404);
    expectErrorShape(res.body, 404, 'NOT_FOUND');
    expect(res.body.message).toBe('Application not found');
  });
});
