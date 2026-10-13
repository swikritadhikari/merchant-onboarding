import { Role } from '../src/modules/users/enums';
import { ApplicationFlow } from './support/application-flow';
import { auth, TestApp, type TestUser, validApplication } from './support/test-app';

describe('Authorization (e2e)', () => {
  let t: TestApp;
  let flow: ApplicationFlow;
  let admin: TestUser;
  let salesA: TestUser;
  let salesB: TestUser;
  let reviewer: TestUser;
  let otherReviewer: TestUser;

  beforeAll(async () => {
    t = await TestApp.create();
    flow = new ApplicationFlow(t);
  });

  beforeEach(async () => {
    await t.reset();
    [admin, salesA, salesB, reviewer, otherReviewer] = await Promise.all([
      t.createUser(Role.Admin),
      t.createUser(Role.Sales),
      t.createUser(Role.Sales),
      t.createUser(Role.Reviewer),
      t.createUser(Role.Reviewer),
    ]);
  });

  afterAll(() => t.close());

  describe('SALES isolation', () => {
    it('cannot read another SALES user’s application by id', async () => {
      const app = await flow.create(salesA);

      const res = await t.http.get(`/api/v1/applications/${app.id}`).set(auth(salesB)).expect(404);
      expect(res.body.message).toBe('Application not found');
    });

    it('cannot update another SALES user’s application, and nothing changes', async () => {
      const app = await flow.create(salesA);

      await t.http
        .patch(`/api/v1/applications/${app.id}`)
        .set(auth(salesB))
        .send({ businessName: 'Hijacked Ltd' })
        .expect(404);

      expect((await flow.get(salesA, app.id)).status).toBe('DRAFT');
      const row = await t.dataSource.query(
        'SELECT business_name FROM merchant_applications WHERE id = $1',
        [app.id],
      );
      expect(row[0].business_name).toBe('Corner Coffee');
    });

    it('cannot submit another SALES user’s application', async () => {
      const app = await flow.create(salesA);

      await t.http.post(`/api/v1/applications/${app.id}/submit`).set(auth(salesB)).expect(404);
      expect((await flow.get(salesA, app.id)).status).toBe('DRAFT');
    });

    it('cannot read another user’s audit trail', async () => {
      const app = await flow.create(salesA);
      await t.http.get(`/api/v1/applications/${app.id}/audit-events`).set(auth(salesB)).expect(403);
      await t.http.get(`/api/v1/applications/${app.id}/audit-events`).set(auth(salesA)).expect(403);
    });

    it('only lists their own applications, including in totals', async () => {
      await flow.create(salesA);
      await flow.create(salesA);
      const mine = await flow.create(salesB);

      const res = await t.http.get('/api/v1/applications').set(auth(salesB)).expect(200);
      const body = res.body as { meta: { total: number }; data: { id: string }[] };
      expect(body.meta.total).toBe(1);
      expect(body.data.map((a) => a.id)).toEqual([mine.id]);
    });

    it('gets the same response for another user’s id and a non-existent id', async () => {
      const app = await flow.create(salesA);
      const foreign = await t.http.get(`/api/v1/applications/${app.id}`).set(auth(salesB));
      const missing = await t.http
        .get('/api/v1/applications/00000000-0000-4000-8000-000000000000')
        .set(auth(salesB));

      expect(foreign.status).toBe(missing.status);
      expect(foreign.body.message).toBe(missing.body.message);
    });
  });

  describe('mass assignment', () => {
    it.each([
      ['status', { status: 'APPROVED' }],
      ['createdById', { createdById: '00000000-0000-4000-8000-000000000000' }],
      ['assignedReviewerId', { assignedReviewerId: '00000000-0000-4000-8000-000000000000' }],
      ['riskStatus', { riskStatus: 'LOW' }],
    ])('rejects a client-supplied %s on create', async (_field, extra) => {
      await t.http
        .post('/api/v1/applications')
        .set(auth(salesA))
        .send(validApplication(extra))
        .expect(400);
    });

    it('rejects a client-supplied status on update', async () => {
      const app = await flow.create(salesA);
      await t.http
        .patch(`/api/v1/applications/${app.id}`)
        .set(auth(salesA))
        .send({ status: 'APPROVED' })
        .expect(400);
    });
  });

  describe('role checks', () => {
    it('SALES cannot assign reviewers or record decisions', async () => {
      const app = await flow.create(salesA);

      await t.http
        .post(`/api/v1/applications/${app.id}/assign`)
        .set(auth(salesA))
        .send({ reviewerId: reviewer.id })
        .expect(403);
      await t.http
        .post(`/api/v1/applications/${app.id}/decision`)
        .set(auth(salesA))
        .send({ decision: 'APPROVE' })
        .expect(403);
    });

    it('REVIEWER cannot create, edit or submit applications', async () => {
      const app = await flow.create(salesA);

      await t.http
        .post('/api/v1/applications')
        .set(auth(reviewer))
        .send(validApplication())
        .expect(403);
      await t.http
        .patch(`/api/v1/applications/${app.id}`)
        .set(auth(reviewer))
        .send({ businessName: 'X Co' })
        .expect(403);
      await t.http.post(`/api/v1/applications/${app.id}/submit`).set(auth(reviewer)).expect(403);
    });

    it('REVIEWER cannot assign applications (not even to themselves)', async () => {
      const app = await flow.create(salesA);
      await t.http
        .post(`/api/v1/applications/${app.id}/assign`)
        .set(auth(reviewer))
        .send({ reviewerId: reviewer.id })
        .expect(403);
    });

    it('only ADMIN can list users', async () => {
      await t.http.get('/api/v1/users').set(auth(salesA)).expect(403);
      await t.http.get('/api/v1/users').set(auth(reviewer)).expect(403);
      await t.http.get('/api/v1/users?role=REVIEWER').set(auth(admin)).expect(200);
    });
  });

  describe('decision rights', () => {
    it('a reviewer who is not assigned cannot record a decision', async () => {
      const app = await flow.readyForDecision(salesA, admin, reviewer);

      const res = await t.http
        .post(`/api/v1/applications/${app.id}/decision`)
        .set(auth(otherReviewer))
        .send({ decision: 'APPROVE', note: 'looks fine' })
        .expect(403);
      expect(res.body.message).toBe('Only the assigned reviewer can record a decision');
      expect((await flow.get(admin, app.id)).status).toBe('UNDER_REVIEW');
    });

    it('ADMIN cannot record a decision on behalf of the assigned reviewer', async () => {
      const app = await flow.readyForDecision(salesA, admin, reviewer);

      await t.http
        .post(`/api/v1/applications/${app.id}/decision`)
        .set(auth(admin))
        .send({ decision: 'APPROVE', note: 'override' })
        .expect(403);
    });

    it('nobody can decide while no reviewer is assigned', async () => {
      const app = await flow.create(salesA);
      await flow.submit(salesA, app.id);
      await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');

      await t.http
        .post(`/api/v1/applications/${app.id}/decision`)
        .set(auth(reviewer))
        .send({ decision: 'APPROVE' })
        .expect(403);
    });

    it('a reassigned-away reviewer loses decision rights immediately', async () => {
      const app = await flow.readyForDecision(salesA, admin, reviewer);
      await flow.assign(admin, app.id, otherReviewer);

      await t.http
        .post(`/api/v1/applications/${app.id}/decision`)
        .set(auth(reviewer))
        .send({ decision: 'APPROVE' })
        .expect(403);
      await t.http
        .post(`/api/v1/applications/${app.id}/decision`)
        .set(auth(otherReviewer))
        .send({ decision: 'APPROVE' })
        .expect(200);
    });
  });
});
