import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  MinLength,
} from 'class-validator';
import { NodeEnv } from '../enums';

const parseBoolean = ({ value }: { value: unknown }): boolean =>
  value === undefined ? true : value === true || value === 'true';

const parseOptionalBoolean = ({ value }: { value: unknown }): boolean | undefined =>
  value === undefined || value === '' ? undefined : value === true || value === 'true';

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  public NODE_ENV: NodeEnv = NodeEnv.Development;

  @Type(() => Number)
  @IsInt()
  public PORT = 3000;

  @IsOptional()
  @IsString()
  public CORS_ORIGINS = '';

  @IsOptional()
  @IsString()
  @Matches(/^(false|true|\d+|loopback|uniquelocal|linklocal)$/, {
    message: 'TRUST_PROXY must be false, true, a hop count, loopback, uniquelocal or linklocal',
  })
  public TRUST_PROXY = 'false';

  @IsOptional()
  @Transform(parseOptionalBoolean)
  @IsBoolean()
  public SWAGGER_ENABLED?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  public HTTP_REQUEST_TIMEOUT_MS = 30_000;

  @Type(() => Number)
  @IsInt()
  @Min(1000)
  public SHUTDOWN_TIMEOUT_MS = 15_000;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  public RATE_LIMIT_PER_MINUTE = 120;

  @IsString()
  public DB_HOST!: string;

  @Type(() => Number)
  @IsInt()
  public DB_PORT = 5432;

  @IsString()
  public DB_USERNAME!: string;

  @IsString()
  public DB_PASSWORD!: string;

  @IsString()
  public DB_NAME!: string;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  public DB_STATEMENT_TIMEOUT_MS = 15_000;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  public DB_LOCK_TIMEOUT_MS = 5_000;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  public DB_CONNECT_TIMEOUT_MS = 5_000;

  @IsString()
  public REDIS_HOST!: string;

  @Type(() => Number)
  @IsInt()
  public REDIS_PORT = 6379;

  @IsOptional()
  @IsString()
  public QUEUE_PREFIX = 'bull';

  @IsOptional()
  @IsString()
  public CACHE_KEY_PREFIX = 'cache';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3600)
  public AUTH_PRINCIPAL_CACHE_TTL_SECONDS = 60;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(86400)
  public USERS_LIST_CACHE_TTL_SECONDS = 300;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  public JWT_SECRET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  public JWT_EXPIRES_IN_SECONDS = 900;

  @IsOptional()
  @IsString()
  public JWT_ISSUER = 'merchant-onboarding-api';

  @IsOptional()
  @IsString()
  public JWT_AUDIENCE = 'merchant-onboarding-clients';

  @Type(() => Number)
  @IsInt()
  @Min(300)
  public REFRESH_TOKEN_EXPIRES_IN_SECONDS = 604800;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  public LOGIN_RATE_LIMIT_PER_MINUTE = 10;

  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(15)
  public PASSWORD_HASH_ROUNDS = 12;

  @Transform(parseBoolean)
  @IsBoolean()
  public RISK_WORKER_ENABLED = true;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  public RISK_JOB_ATTEMPTS = 5;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  public RISK_JOB_BACKOFF_MS = 2000;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  public RISK_PROVIDER_LATENCY_MS = 300;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  public RISK_PROVIDER_FAILURE_RATE = 0;

  @Type(() => Number)
  @IsInt()
  @Min(10)
  public RISK_PROVIDER_TIMEOUT_MS = 5_000;
}
