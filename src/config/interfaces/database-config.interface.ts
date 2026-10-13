export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  statementTimeoutMs: number;
  lockTimeoutMs: number;
  connectTimeoutMs: number;
}
