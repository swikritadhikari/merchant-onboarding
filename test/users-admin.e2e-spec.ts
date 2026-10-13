import { Role } from '../src/modules/users/enums';
import { auth, TestApp, type TestUser } from './support/test-app';

describe('User administration (e2e)', () => {
  let t: TestApp;
  let admin: TestUser;

  beforeAll(async () => {
    t = await TestApp.create();
  });

  beforeEach(async () => {
    await t.reset();
    admin = await t.createUser(Role.Admin);
  });

  afterAll(() => t.close());

  const reviewerIds = async () => {
    const res = await t.http.get('/api/v1/users?role=REVIEWER').set(auth(admin)).expect(200);
    return (res.body as { id: string }[]).map((u) => u.id);
  };

  it('keeps the cached reviewer list correct when users are added or deactivated', async () => {
    const first = await t.createUser(Role.Reviewer, { login: false });
    expect(await reviewerIds()).toEqual([first.id]);

    const second = await t.createUser(Role.Reviewer, { login: false });
    expect((await reviewerIds()).sort()).toEqual([first.id, second.id].sort());

    await t.http
      .patch(`/api/v1/users/${first.id}`)
      .set(auth(admin))
      .send({ isActive: false })
      .expect(200);
    expect(await reviewerIds()).toEqual([second.id]);
  });

  it('records role and status changes in the audit log', async () => {
    const user = await t.createUser(Role.Sales, { login: false });

    await t.http
      .patch(`/api/v1/users/${user.id}`)
      .set(auth(admin))
      .send({ role: Role.Reviewer, isActive: false })
      .expect(200);

    const rows = await t.dataSource.query<{ action: string; actor_id: string; metadata: object }[]>(
      `SELECT action, actor_id, metadata FROM audit_logs WHERE entity_type = 'User' AND entity_id = $1`,
      [user.id],
    );
    expect(rows).toEqual([
      {
        action: 'USER_UPDATED',
        actor_id: admin.id,
        metadata: {
          changes: { role: { from: 'SALES', to: 'REVIEWER' }, isActive: { from: true, to: false } },
        },
      },
    ]);
  });

  it('stops an admin from locking themselves out', async () => {
    await t.http
      .patch(`/api/v1/users/${admin.id}`)
      .set(auth(admin))
      .send({ isActive: false })
      .expect(422);
    await t.http
      .patch(`/api/v1/users/${admin.id}`)
      .set(auth(admin))
      .send({ role: Role.Sales })
      .expect(422);
  });

  it('is restricted to ADMIN and validates input', async () => {
    const sales = await t.createUser(Role.Sales);

    await t.http
      .patch(`/api/v1/users/${sales.id}`)
      .set(auth(sales))
      .send({ role: Role.Admin })
      .expect(403);
    await t.http
      .patch(`/api/v1/users/${sales.id}`)
      .set(auth(admin))
      .send({ role: 'ROOT' })
      .expect(400);
    await t.http
      .patch('/api/v1/users/00000000-0000-4000-8000-000000000000')
      .set(auth(admin))
      .send({ isActive: false })
      .expect(404);
  });
});
