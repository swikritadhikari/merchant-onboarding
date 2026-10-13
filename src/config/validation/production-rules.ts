import { NodeEnv } from '../enums';
import { type EnvironmentVariables } from './environment-variables';

const MIN_PRODUCTION_HASH_ROUNDS = 12;

export function productionViolations(env: EnvironmentVariables): string[] {
  if (env.NODE_ENV !== NodeEnv.Production) {
    return [];
  }
  const violations: string[] = [];
  const origins = env.CORS_ORIGINS.split(',').map((origin) => origin.trim());
  if (origins.includes('*')) {
    violations.push('CORS_ORIGINS must list explicit origins in production, not "*"');
  }
  if (origins.some((origin) => origin.startsWith('http://') && !origin.includes('localhost'))) {
    violations.push('CORS_ORIGINS must use https origins in production');
  }
  if (env.RISK_PROVIDER_FAILURE_RATE > 0) {
    violations.push('RISK_PROVIDER_FAILURE_RATE must be 0 in production');
  }
  if (env.PASSWORD_HASH_ROUNDS < MIN_PRODUCTION_HASH_ROUNDS) {
    violations.push(
      `PASSWORD_HASH_ROUNDS must be at least ${MIN_PRODUCTION_HASH_ROUNDS} in production`,
    );
  }
  return violations;
}
