import { config } from 'dotenv';

config({ quiet: true });

const testDb = process.env.DB_TEST_NAME;
if (!testDb) {
  throw new Error('DB_TEST_NAME must be set for integration tests');
}

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_NAME: testDb,
  QUEUE_PREFIX: `test-${process.pid}`,
  CACHE_KEY_PREFIX: `test-cache-${process.pid}`,
  RISK_JOB_ATTEMPTS: '3',
  RISK_JOB_BACKOFF_MS: '20',
  RISK_PROVIDER_LATENCY_MS: '0',
  RISK_PROVIDER_FAILURE_RATE: '0',
  RISK_PROVIDER_TIMEOUT_MS: '300',
  LOGIN_RATE_LIMIT_PER_MINUTE: '1000',
  PASSWORD_HASH_ROUNDS: '4',
  RATE_LIMIT_PER_MINUTE: '100000',
  CORS_ORIGINS: 'https://app.example.test',
});
