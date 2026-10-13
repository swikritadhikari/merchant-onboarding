import { join } from 'path';
import { type PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { type DatabaseConfig } from '../../config/interfaces';
import { ENTITIES } from './entities';

export const MIGRATIONS_TABLE = 'schema_migrations';

export function buildTypeOrmOptions(db: DatabaseConfig): PostgresConnectionOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.username,
    password: db.password,
    database: db.database,
    extra: {
      statement_timeout: db.statementTimeoutMs,
      lock_timeout: db.lockTimeoutMs,
      idle_in_transaction_session_timeout: db.statementTimeoutMs * 2,
      connectionTimeoutMillis: db.connectTimeoutMs,
    },
    entities: [...ENTITIES],
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
    migrationsTableName: MIGRATIONS_TABLE,
    uuidExtension: 'pgcrypto',
    installExtensions: false,
    synchronize: false,
    migrationsRun: false,
    logging: ['error', 'warn', 'migration'],
  };
}
