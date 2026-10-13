import { config } from 'dotenv';
import { Client } from 'pg';

const DEFAULT_POSTGRES_PORT = 5432;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_]+$/;

export default async function globalSetup(): Promise<void> {
  config({ quiet: true });
  const testDatabase = process.env.DB_TEST_NAME;
  if (testDatabase === undefined || !SAFE_IDENTIFIER.test(testDatabase)) {
    throw new Error('DB_TEST_NAME must be set to a plain identifier for integration tests');
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? DEFAULT_POSTGRES_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      testDatabase,
    ]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${testDatabase}"`);
    }
  } finally {
    await client.end();
  }
}
