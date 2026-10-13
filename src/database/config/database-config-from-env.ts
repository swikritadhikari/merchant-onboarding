import { type DatabaseConfig } from '../../config/interfaces';

const DEFAULT_POSTGRES_PORT = 5432;
const DEFAULT_STATEMENT_TIMEOUT_MS = 15_000;
const DEFAULT_LOCK_TIMEOUT_MS = 5_000;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;

export function databaseConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  return {
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? DEFAULT_POSTGRES_PORT),
    username: env.DB_USERNAME ?? '',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? '',
    statementTimeoutMs: Number(env.DB_STATEMENT_TIMEOUT_MS ?? DEFAULT_STATEMENT_TIMEOUT_MS),
    lockTimeoutMs: Number(env.DB_LOCK_TIMEOUT_MS ?? DEFAULT_LOCK_TIMEOUT_MS),
    connectTimeoutMs: Number(env.DB_CONNECT_TIMEOUT_MS ?? DEFAULT_CONNECT_TIMEOUT_MS),
  };
}
