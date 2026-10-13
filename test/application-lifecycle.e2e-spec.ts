import { RiskLevel } from '../src/modules/risk/enums';
import { Role } from '../src/modules/users/enums';
import { ApplicationFlow } from './support/application-flow';
import { auth, TestApp, type TestUser, validApplication } from './support/test-app';

describe('Application lifecycle (e2e)', () => {
  let t: TestApp;
  let flow: ApplicationFlow;
  let admin: TestUser;
  let sales: TestUser;
  let reviewer: TestUser;

  beforeAll(async () => {
    t = await TestApp.create();
    flow = new ApplicationFlow(t);
  });

  beforeEach(async () => {
    await t.reset();
    [admin, sales, reviewer] = await Promise.all([
      t.createUser(Role.Admin),
      t.createUser(Role.Sales),
      t.createUser(Role.Reviewer),
    ]);
  });

  afterAll(() => t.close());

  const decide = (id: string, body: object, user = reviewer) =>
    t.http.post(`/api/v1/applications/${id}/decision`).set(auth(user)).send(body);

  const auditActions = async (id: string) => {
    const res = await t.http
      .get(`/api/v1/applications/${id}/audit-events`)
      .set(auth(admin))
      .expect(200);
    return (res.body as { action: string }[]).map((e) => e.action);
  };

  it('runs the happy path from draft to approval with a full audit trail', async () => {
    const created = await flow.create(sales);
    expect(created).toMatchObject({
      status: 'DRAFT',
      risk: { status: 'NOT_STARTED', score: null },
      createdById: sales.id,
      submissionCount: 0,
    });

    const submitted = await flow.submit(sales, created.id);
    expect(submitted).toMatchObject({
      status: 'SUBMITTED',
      submissionCount: 1,
      risk: { status: 'PENDING' },
    });

    const reviewed = await flow.waitForStatus(sales, created.id, 'UNDER_REVIEW');
    expect(['LOW', 'MEDIUM', 'HIGH']).toContain(reviewed.risk.status);
    expect(reviewed.risk.score).toEqual(expect.any(Number));

    await flow.assign(admin, created.id, reviewer);
    const approved = await decide(created.id, {
      decision: 'APPROVE',
      note: 'KYB documents verified',
    }).expect(200);
    expect(approved.body).toMatchObject({
      status: 'APPROVED',
      decision: { decision: 'APPROVE', note: 'KYB documents verified', decidedById: reviewer.id },
    });

    expect(await auditActions(created.id)).toEqual([
      'APPLICATION_CREATED',
      'APPLICATION_SUBMITTED',
      'RISK_REVIEW_COMPLETED',
      'REVIEWER_ASSIGNED',
      'REVIEW_DECISION_RECORDED',
    ]);
  });

  it('never returns sensitive identifiers in clear text', async () => {
    const app = await flow.create(sales, {
      taxId: '98-7654321',
      bankAccountNumber: '000111222333',
    });
    expect(app.taxId).toBe('******4321');
    expect(app.bankAccountNumber).toBe('********2333');

    const listed = await t.http.get('/api/v1/applications').set(auth(admin)).expect(200);
    expect(JSON.stringify(listed.body)).not.toContain('98-7654321');
  });

  it('keeps sensitive values and secrets out of the audit log', async () => {
    const app = await flow.create(sales);
    await t.http
      .patch(`/api/v1/applications/${app.id}`)
      .set(auth(sales))
      .send({ taxId: '11-2223333', bankAccountNumber: '999888777666' })
      .expect(200);

    const rows: { metadata: object }[] = await t.dataSource.query(
      'SELECT metadata FROM audit_logs WHERE entity_id = $1',
      [app.id],
    );
    const dump = JSON.stringify(rows);
    expect(dump).toContain('changedFields');
    expect(dump).not.toContain('11-2223333');
    expect(dump).not.toContain('999888777666');
  });

  describe('editing', () => {
    it('allows edits while DRAFT', async () => {
      const app = await flow.create(sales);
      const res = await t.http
        .patch(`/api/v1/applications/${app.id}`)
        .set(auth(sales))
        .send({ businessName: 'Corner Coffee & Bakery' })
        .expect(200);
      expect(res.body.businessName).toBe('Corner Coffee & Bakery');
    });

    it.each(['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'])('blocks edits once %s', async (status) => {
      const app = await flow.create(sales);
      await flow.submit(sales, app.id);
      if (status !== 'SUBMITTED') {
        await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');
      }
      if (status === 'APPROVED') {
        await flow.assign(admin, app.id, reviewer);
        await decide(app.id, { decision: 'APPROVE', note: 'ok' }).expect(200);
      }

      await t.http
        .patch(`/api/v1/applications/${app.id}`)
        .set(auth(sales))
        .send({ businessName: 'Too Late Ltd' })
        .expect(409);
    });

    it('enforces cross-field rules', async () => {
      await t.http
        .post('/api/v1/applications')
        .set(auth(sales))
        .send(
          validApplication({
            processing: {
              monthlyVolumeMinor: 1000,
              averageTicketMinor: 5000,
              currency: 'USD',
              mcc: '5812',
            },
          }),
        )
        .expect(422);
    });

    it('validates the payload', async () => {
      const res = await t.http
        .post('/api/v1/applications')
        .set(auth(sales))
        .send(validApplication({ owner: { fullName: 'J', email: 'nope', phone: '123' } }))
        .expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'owner.email' }),
          expect.objectContaining({ field: 'owner.phone' }),
          expect.objectContaining({ field: 'owner.fullName' }),
        ]),
      );
    });
  });

  describe('invalid transitions', () => {
    it('cannot submit twice', async () => {
      const app = await flow.create(sales);
      await flow.submit(sales, app.id);
      await t.http.post(`/api/v1/applications/${app.id}/submit`).set(auth(sales)).expect(409);
    });

    it('cannot decide before risk review has completed', async () => {
      const app = await flow.create(sales);
      await flow.assign(admin, app.id, reviewer);

      const res = await decide(app.id, { decision: 'APPROVE' }).expect(409);
      expect(res.body.code).toBe('INVALID_STATE_TRANSITION');
    });

    it('cannot decide twice', async () => {
      const app = await flow.readyForDecision(sales, admin, reviewer);
      await decide(app.id, { decision: 'REJECT', note: 'Unverifiable ownership' }).expect(200);
      await decide(app.id, { decision: 'APPROVE', note: 'changed my mind' }).expect(409);
    });

    it('cannot reassign a closed application', async () => {
      const app = await flow.readyForDecision(sales, admin, reviewer);
      await decide(app.id, { decision: 'APPROVE' }).expect(200);
      await t.http
        .post(`/api/v1/applications/${app.id}/assign`)
        .set(auth(admin))
        .send({ reviewerId: reviewer.id })
        .expect(409);
    });

    it('only assigns active reviewers', async () => {
      const app = await flow.create(sales);
      await t.http
        .post(`/api/v1/applications/${app.id}/assign`)
        .set(auth(admin))
        .send({ reviewerId: sales.id })
        .expect(422);
    });
  });

  describe('reviewer decisions', () => {
    it('requires a note to reject', async () => {
      const app = await flow.readyForDecision(sales, admin, reviewer);
      await decide(app.id, { decision: 'REJECT' }).expect(422);
      await decide(app.id, { decision: 'REJECT', note: 'Prohibited business' }).expect(200);
    });

    it('requires a justification to approve HIGH risk', async () => {
      t.riskProvider.respondWith({ score: 91, level: RiskLevel.High, reasons: ['HIGH_RISK_MCC'] });
      const app = await flow.readyForDecision(sales, admin, reviewer);
      expect((await flow.get(reviewer, app.id)).risk.status).toBe('HIGH');

      await decide(app.id, { decision: 'APPROVE' }).expect(422);
      await decide(app.id, { decision: 'APPROVE', note: 'Rolling reserve agreed' }).expect(200);
    });

    it('supports request-info → edit → resubmit with a fresh risk review', async () => {
      const app = await flow.readyForDecision(sales, admin, reviewer);
      await decide(app.id, { decision: 'REQUEST_INFO', note: 'Upload proof of address' }).expect(
        200,
      );

      const edited = await t.http
        .patch(`/api/v1/applications/${app.id}`)
        .set(auth(sales))
        .send({ legalBusinessName: 'Corner Coffee Holdings LLC (Delaware)' })
        .expect(200);
      expect(edited.body.status).toBe('INFO_REQUESTED');

      const resubmitted = await flow.submit(sales, app.id);
      expect(resubmitted).toMatchObject({
        submissionCount: 2,
        decision: null,
        risk: { status: 'PENDING' },
      });

      await flow.waitForStatus(reviewer, app.id, 'UNDER_REVIEW');
      const assessments = await t.dataSource.query<{ submission_no: number }[]>(
        'SELECT submission_no FROM risk_assessments WHERE application_id = $1 ORDER BY submission_no',
        [app.id],
      );
      expect(assessments.map((r) => r.submission_no)).toEqual([1, 2]);

      await decide(app.id, { decision: 'APPROVE' }).expect(200);
    });
  });

  describe('listing', () => {
    it('filters by status and paginates', async () => {
      const drafts = await Promise.all([1, 2, 3].map(() => flow.create(sales)));
      await flow.submit(sales, drafts[0]!.id);

      const page1 = await t.http
        .get('/api/v1/applications?status=DRAFT&limit=1&page=1')
        .set(auth(admin))
        .expect(200);
      expect(page1.body.meta).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });

      const page2 = await t.http
        .get('/api/v1/applications?status=DRAFT&limit=1&page=2')
        .set(auth(admin))
        .expect(200);
      expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);

      const multi = await t.http
        .get('/api/v1/applications?status=DRAFT,SUBMITTED,UNDER_REVIEW')
        .set(auth(admin))
        .expect(200);
      expect(multi.body.meta.total).toBe(3);
    });

    it('lets a reviewer filter to their own queue', async () => {
      const mine = await flow.create(sales);
      await flow.create(sales);
      await flow.assign(admin, mine.id, reviewer);

      const res = await t.http
        .get('/api/v1/applications?assignedToMe=true')
        .set(auth(reviewer))
        .expect(200);
      const body = res.body as { data: { id: string }[] };
      expect(body.data.map((a) => a.id)).toEqual([mine.id]);
    });

    it('rejects invalid filters and oversized pages', async () => {
      await t.http.get('/api/v1/applications?status=BOGUS').set(auth(admin)).expect(400);
      await t.http.get('/api/v1/applications?limit=1000').set(auth(admin)).expect(400);
    });
  });

  it('serialises concurrent decisions so only one wins', async () => {
    const app = await flow.readyForDecision(sales, admin, reviewer);

    const results = await Promise.all([
      decide(app.id, { decision: 'APPROVE' }),
      decide(app.id, { decision: 'REJECT', note: 'Conflicting decision' }),
    ]);

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
    const decisions = await t.dataSource.query(
      `SELECT count(*)::int AS n FROM audit_logs WHERE entity_id = $1 AND action = 'REVIEW_DECISION_RECORDED'`,
      [app.id],
    );
    expect(decisions[0].n).toBe(1);
  });
});
