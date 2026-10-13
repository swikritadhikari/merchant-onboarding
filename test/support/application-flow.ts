import { auth, type TestApp, type TestUser, validApplication } from './test-app';

export interface ApplicationBody {
  id: string;
  status: string;
  risk: { status: string; score: number | null };
  submissionCount: number;
  assignedReviewerId: string | null;
  createdById: string;
  taxId: string;
  bankAccountNumber: string;
  decision: { decision: string; note: string | null } | null;
}

export class ApplicationFlow {
  constructor(private readonly t: TestApp) {}

  async create(sales: TestUser, overrides: Record<string, unknown> = {}): Promise<ApplicationBody> {
    const res = await this.t.http
      .post('/api/v1/applications')
      .set(auth(sales))
      .send(validApplication(overrides))
      .expect(201);
    return res.body as ApplicationBody;
  }

  async get(user: TestUser, id: string): Promise<ApplicationBody> {
    const res = await this.t.http.get(`/api/v1/applications/${id}`).set(auth(user)).expect(200);
    return res.body as ApplicationBody;
  }

  async submit(user: TestUser, id: string): Promise<ApplicationBody> {
    const res = await this.t.http
      .post(`/api/v1/applications/${id}/submit`)
      .set(auth(user))
      .expect(202);
    return res.body as ApplicationBody;
  }

  async assign(admin: TestUser, id: string, reviewer: TestUser): Promise<ApplicationBody> {
    const res = await this.t.http
      .post(`/api/v1/applications/${id}/assign`)
      .set(auth(admin))
      .send({ reviewerId: reviewer.id })
      .expect(200);
    return res.body as ApplicationBody;
  }

  waitForStatus(viewer: TestUser, id: string, status: string): Promise<ApplicationBody> {
    return this.t.waitFor(
      () => this.get(viewer, id),
      (app) => app.status === status,
    );
  }

  async readyForDecision(
    sales: TestUser,
    admin: TestUser,
    reviewer: TestUser,
    overrides: Record<string, unknown> = {},
  ): Promise<ApplicationBody> {
    const app = await this.create(sales, overrides);
    await this.submit(sales, app.id);
    await this.waitForStatus(admin, app.id, 'UNDER_REVIEW');
    return this.assign(admin, app.id, reviewer);
  }
}
