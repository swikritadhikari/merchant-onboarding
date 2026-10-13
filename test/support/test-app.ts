import { getQueueToken } from '@nestjs/bullmq';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { type Queue } from 'bullmq';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions, databaseConfigFromEnv } from '../../src/database/config';
import { AppModule } from '../../src/app.module';
import { configureHttpApp, HTTP_APP_OPTIONS } from '../../src/bootstrap';
import { AppConfigService } from '../../src/config/app-config.service';
import { CacheService } from '../../src/common/cache';
import { RISK_PROVIDER, RISK_REVIEW_QUEUE } from '../../src/modules/risk/constants';
import { type Role } from '../../src/modules/users/enums';
import { UsersService } from '../../src/modules/users/users.service';
import { ScriptedRiskProvider } from './scripted-risk.provider';

export interface TestUser {
  id: string;
  email: string;
  role: Role;
  token: string;
}

export class TestApp {
  private constructor(
    readonly app: NestExpressApplication,
    readonly riskProvider: ScriptedRiskProvider,
  ) {}

  static async create(): Promise<TestApp> {
    await TestApp.migrate();

    const riskProvider = new ScriptedRiskProvider();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register({ withWorker: true })],
    })
      .overrideProvider(RISK_PROVIDER)
      .useValue(riskProvider)
      .compile();

    const app = moduleRef.createNestApplication<NestExpressApplication>({
      ...HTTP_APP_OPTIONS,
      logger: ['error'],
    });
    configureHttpApp(app, app.get(AppConfigService));
    await app.init();
    return new TestApp(app, riskProvider);
  }

  private static async migrate(): Promise<void> {
    const ds = new DataSource({
      ...buildTypeOrmOptions(databaseConfigFromEnv()),
      logging: ['error'],
    });
    await ds.initialize();
    try {
      await ds.runMigrations();
    } finally {
      await ds.destroy();
    }
  }

  get http() {
    return request(this.app.getHttpServer());
  }

  get dataSource(): DataSource {
    return this.app.get<DataSource>(getDataSourceToken());
  }

  get queue(): Queue {
    return this.app.get<Queue>(getQueueToken(RISK_REVIEW_QUEUE));
  }

  get<T>(token: new (...args: never[]) => T): T {
    return this.app.get(token);
  }

  async reset(): Promise<void> {
    this.riskProvider.reset();
    await this.waitFor(
      () => this.queue.getActiveCount(),
      (n) => n === 0,
    );
    await this.queue.drain(true);
    await this.get(CacheService).evictByPrefix('');
    await this.dataSource.query(
      'TRUNCATE audit_logs, risk_assessments, merchant_applications, users RESTART IDENTITY CASCADE',
    );
  }

  async close(): Promise<void> {
    await this.queue.obliterate({ force: true });
    await this.app.close();
  }

  private userSeq = 0;

  async createUser(role: Role, opts: { login?: boolean } = {}): Promise<TestUser> {
    const n = ++this.userSeq;
    const email = `${role.toLowerCase()}.${n}.${Date.now()}@example.test`;
    const password = `pw-${n}-${Math.random().toString(36).slice(2)}`;
    const user = await this.get(UsersService).create({
      email,
      password,
      role,
      fullName: `${role} ${n}`,
    });

    let token = '';
    if (opts.login !== false) {
      const res = await this.http.post('/api/v1/auth/login').send({ email, password }).expect(200);
      token = (res.body as { accessToken: string }).accessToken;
    }
    return { id: user.id, email, role, token };
  }

  async waitFor<T>(
    probe: () => Promise<T>,
    predicate: (value: T) => boolean,
    timeoutMs = 10_000,
  ): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    let last: T = await probe();
    while (!predicate(last)) {
      if (Date.now() > deadline) {
        throw new Error(
          `Condition not met within ${timeoutMs}ms; last value: ${JSON.stringify(last)}`,
        );
      }
      await new Promise((r) => setTimeout(r, 50));
      last = await probe();
    }
    return last;
  }
}

export const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.token}` });

export const validApplication = (overrides: Record<string, unknown> = {}) => ({
  businessName: 'Corner Coffee',
  legalBusinessName: 'Corner Coffee Holdings LLC',
  businessType: 'LLC',
  taxId: '00-0000001',
  bankAccountNumber: '000123456789',
  owner: { fullName: 'Jane Example', email: 'jane@example.test', phone: '+15555550100' },
  processing: {
    monthlyVolumeMinor: 2_500_000,
    averageTicketMinor: 4_500,
    currency: 'USD',
    mcc: '5812',
  },
  ...overrides,
});
