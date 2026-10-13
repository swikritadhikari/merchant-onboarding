import { RiskLevel, RiskReviewJob } from '../src/modules/risk/enums';
import { RiskReviewProducer } from '../src/modules/risk/producers';
import { assessJobId } from '../src/modules/risk/utils';
import { RiskReviewService } from '../src/modules/risk/risk-review.service';
import { Role } from '../src/modules/users/enums';
import { ApplicationFlow } from './support/application-flow';
import { auth, TestApp, type TestUser } from './support/test-app';

describe('Asynchronous risk review (e2e)', () => {
  let t: TestApp;
  let flow: ApplicationFlow;
  let admin: TestUser;
  let sales: TestUser;

  beforeAll(async () => {
    t = await TestApp.create();
    flow = new ApplicationFlow(t);
  });

  beforeEach(async () => {
    await t.reset();
    [admin, sales] = await Promise.all([t.createUser(Role.Admin), t.createUser(Role.Sales)]);
  });

  afterAll(() => t.close());

  const assessments = (applicationId: string) =>
    t.dataSource.query<{ submission_no: number; attempt: number; risk_level: string }[]>(
      'SELECT submission_no, attempt, risk_level FROM risk_assessments WHERE application_id = $1',
      [applicationId],
    );

  const auditActions = async (id: string) => {
    const res = await t.http
      .get(`/api/v1/applications/${id}/audit-events`)
      .set(auth(admin))
      .expect(200);
    return res.body as {
      action: string;
      actorId: string | null;
      metadata: Record<string, unknown>;
    }[];
  };

  it('persists the provider result and moves the application to UNDER_REVIEW', async () => {
    t.riskProvider.respondWith({
      score: 55,
      level: RiskLevel.Medium,
      reasons: ['HIGH_PROCESSING_VOLUME'],
    });
    const app = await flow.create(sales);
    await flow.submit(sales, app.id);

    const reviewed = await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');
    expect(reviewed.risk).toMatchObject({ status: 'MEDIUM', score: 55 });
    expect(await assessments(app.id)).toEqual([
      { submission_no: 1, attempt: 1, risk_level: 'MEDIUM' },
    ]);

    const completed = (await auditActions(app.id)).find(
      (e) => e.action === 'RISK_REVIEW_COMPLETED',
    );
    expect(completed).toMatchObject({
      actorId: null,
      metadata: { riskLevel: 'MEDIUM', score: 55 },
    });
  });

  it('sends the provider an idempotency key scoped to the submission', async () => {
    const app = await flow.create(sales);
    await flow.submit(sales, app.id);
    await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');

    expect(t.riskProvider.calls[0]?.idempotencyKey).toBe(`${app.id}:1`);
  });

  it('retries transient provider failures with backoff and then succeeds', async () => {
    t.riskProvider.failTransiently(2);
    const app = await flow.create(sales);
    await flow.submit(sales, app.id);

    await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');
    expect(t.riskProvider.calls).toHaveLength(3);
    expect(await assessments(app.id)).toEqual([expect.objectContaining({ attempt: 3 })]);
  });

  it('times out a hung provider call and retries it', async () => {
    t.riskProvider.hangOnce();
    const app = await flow.create(sales);
    await flow.submit(sales, app.id);

    await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');
    expect(t.riskProvider.calls).toHaveLength(2);
    expect(await assessments(app.id)).toEqual([expect.objectContaining({ attempt: 2 })]);
  });

  it('marks the application RISK_FAILED once retries are exhausted, and allows a resubmit', async () => {
    t.riskProvider.failTransiently(3);
    const app = await flow.create(sales);
    await flow.submit(sales, app.id);

    const failed = await flow.waitForStatus(admin, app.id, 'RISK_FAILED');
    expect(failed.risk.status).toBe('ERROR');
    expect(t.riskProvider.calls).toHaveLength(3);
    expect(await assessments(app.id)).toHaveLength(0);
    expect((await auditActions(app.id)).map((e) => e.action)).toContain('RISK_REVIEW_FAILED');

    await flow.submit(sales, app.id);
    await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');
  });

  it('does not retry a permanent provider rejection', async () => {
    t.riskProvider.failPermanently('Tax id not found in registry');
    const app = await flow.create(sales);
    await flow.submit(sales, app.id);

    await flow.waitForStatus(admin, app.id, 'RISK_FAILED');
    expect(t.riskProvider.calls).toHaveLength(1);
  });

  describe('idempotency', () => {
    it('ignores a duplicate enqueue of the same submission', async () => {
      const app = await flow.create(sales);
      await flow.submit(sales, app.id);
      await t.get(RiskReviewProducer).enqueueAssessment({ applicationId: app.id, submissionNo: 1 });
      await t.get(RiskReviewProducer).enqueueAssessment({ applicationId: app.id, submissionNo: 1 });

      await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');
      await new Promise((r) => setTimeout(r, 300));

      expect(t.riskProvider.calls).toHaveLength(1);
      expect(await assessments(app.id)).toHaveLength(1);
    });

    it('skips a redelivered job after the submission has already been assessed', async () => {
      const app = await flow.create(sales);
      await flow.submit(sales, app.id);
      await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');

      const replay = await t
        .get(RiskReviewService)
        .assess({ applicationId: app.id, submissionNo: 1 }, 1);

      expect(replay).toEqual({ outcome: 'skipped', reason: 'stale_submission' });
      expect(await assessments(app.id)).toHaveLength(1);
      expect(
        (await auditActions(app.id)).filter((e) => e.action === 'RISK_REVIEW_COMPLETED'),
      ).toHaveLength(1);
    });

    it('lets only one of two concurrent deliveries write a result', async () => {
      const app = await flow.create(sales);
      await t.queue.pause();
      try {
        await flow.submit(sales, app.id);
        const service = t.get(RiskReviewService);
        const results = await Promise.all([
          service.assess({ applicationId: app.id, submissionNo: 1 }, 1),
          service.assess({ applicationId: app.id, submissionNo: 1 }, 1),
        ]);

        expect(results.map((r) => r.outcome).sort()).toEqual(['completed', 'skipped']);
        expect(await assessments(app.id)).toHaveLength(1);
      } finally {
        await t.queue.drain();
        await t.queue.resume();
      }
    });

    it('drops a job for an outdated submission number', async () => {
      const app = await flow.create(sales);
      await flow.submit(sales, app.id);
      await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');

      const stale = await t
        .get(RiskReviewService)
        .assess({ applicationId: app.id, submissionNo: 0 }, 1);
      expect(stale).toEqual({ outcome: 'skipped', reason: 'stale_submission' });
    });
  });

  it('reconciles submissions that were never enqueued', async () => {
    const app = await flow.create(sales);
    await t.queue.pause();
    try {
      await flow.submit(sales, app.id);
      await t.queue.remove(assessJobId({ applicationId: app.id, submissionNo: 1 }));
      await t.dataSource.query(
        `UPDATE merchant_applications SET submitted_at = now() - interval '1 hour' WHERE id = $1`,
        [app.id],
      );
    } finally {
      await t.queue.resume();
    }

    await t.queue.add(RiskReviewJob.Reconcile, {});
    await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');
  });

  it('records job outcomes on the queue for observability', async () => {
    const app = await flow.create(sales);
    await flow.submit(sales, app.id);
    await flow.waitForStatus(admin, app.id, 'UNDER_REVIEW');

    const job = (await t.queue.getJob(assessJobId({ applicationId: app.id, submissionNo: 1 })))!;
    await t.waitFor(
      () => job.getState(),
      (s) => s === 'completed',
    );
  });
});
