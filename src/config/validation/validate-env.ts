import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { EnvironmentVariables } from './environment-variables';
import { productionViolations } from './production-rules';

export function validateEnv(raw: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: false });
  const errors = validateSync(env, { skipMissingProperties: false })
    .flatMap((error) => Object.values(error.constraints ?? {}))
    .concat(productionViolations(env));
  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.join('; ')}`);
  }
  return env;
}
