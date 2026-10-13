import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NodeEnv } from './enums';
import {
  type CacheConfig,
  type DatabaseConfig,
  type HttpConfig,
  type JwtConfig,
  type RedisConfig,
  type RefreshTokenConfig,
  type RiskReviewConfig,
} from './interfaces';
import { parseTrustProxy } from './utils';
import { type EnvironmentVariables } from './validation';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvironmentVariables, true>) {}

  public get nodeEnv(): NodeEnv {
    return this.get('NODE_ENV');
  }

  public get isProduction(): boolean {
    return this.nodeEnv === NodeEnv.Production;
  }

  public get isDevelopment(): boolean {
    return this.nodeEnv === NodeEnv.Development;
  }

  public get http(): HttpConfig {
    return {
      corsOrigins: this.get('CORS_ORIGINS')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
      trustProxy: parseTrustProxy(this.get('TRUST_PROXY')),
      requestTimeoutMs: this.get('HTTP_REQUEST_TIMEOUT_MS'),
      swaggerEnabled: this.swaggerFlag ?? !this.isProduction,
      rateLimitPerMinute: this.get('RATE_LIMIT_PER_MINUTE'),
      authRateLimitPerMinute: this.get('LOGIN_RATE_LIMIT_PER_MINUTE'),
    };
  }

  private get swaggerFlag(): boolean | undefined {
    const value: unknown = this.get('SWAGGER_ENABLED');
    return typeof value === 'boolean' ? value : undefined;
  }

  public get shutdownTimeoutMs(): number {
    return this.get('SHUTDOWN_TIMEOUT_MS');
  }

  public get port(): number {
    return this.get('PORT');
  }

  public get database(): DatabaseConfig {
    return {
      host: this.get('DB_HOST'),
      port: this.get('DB_PORT'),
      username: this.get('DB_USERNAME'),
      password: this.get('DB_PASSWORD'),
      database: this.get('DB_NAME'),
      statementTimeoutMs: this.get('DB_STATEMENT_TIMEOUT_MS'),
      lockTimeoutMs: this.get('DB_LOCK_TIMEOUT_MS'),
      connectTimeoutMs: this.get('DB_CONNECT_TIMEOUT_MS'),
    };
  }

  public get redis(): RedisConfig {
    return { host: this.get('REDIS_HOST'), port: this.get('REDIS_PORT') };
  }

  public get queuePrefix(): string {
    return this.get('QUEUE_PREFIX');
  }

  public get cache(): CacheConfig {
    return {
      keyPrefix: this.get('CACHE_KEY_PREFIX'),
      principalTtlSeconds: this.get('AUTH_PRINCIPAL_CACHE_TTL_SECONDS'),
      usersListTtlSeconds: this.get('USERS_LIST_CACHE_TTL_SECONDS'),
    };
  }

  public get jwt(): JwtConfig {
    return {
      secret: this.get('JWT_SECRET'),
      expiresInSeconds: this.get('JWT_EXPIRES_IN_SECONDS'),
      issuer: this.get('JWT_ISSUER'),
      audience: this.get('JWT_AUDIENCE'),
    };
  }

  public get refreshToken(): RefreshTokenConfig {
    return { expiresInSeconds: this.get('REFRESH_TOKEN_EXPIRES_IN_SECONDS') };
  }

  public get passwordHashRounds(): number {
    return this.get('PASSWORD_HASH_ROUNDS');
  }

  public get loginRateLimitPerMinute(): number {
    return this.get('LOGIN_RATE_LIMIT_PER_MINUTE');
  }

  public get riskReview(): RiskReviewConfig {
    return {
      workerEnabled: this.get('RISK_WORKER_ENABLED'),
      attempts: this.get('RISK_JOB_ATTEMPTS'),
      backoffMs: this.get('RISK_JOB_BACKOFF_MS'),
      providerLatencyMs: this.get('RISK_PROVIDER_LATENCY_MS'),
      providerFailureRate: this.get('RISK_PROVIDER_FAILURE_RATE'),
      providerTimeoutMs: this.get('RISK_PROVIDER_TIMEOUT_MS'),
    };
  }

  private get<K extends keyof EnvironmentVariables>(key: K): EnvironmentVariables[K] {
    return this.config.get(key, { infer: true });
  }
}
