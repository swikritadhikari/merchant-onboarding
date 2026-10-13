import 'reflect-metadata';
import { NodeEnv } from '../enums';
import { EnvironmentVariables } from './environment-variables';
import { productionViolations } from './production-rules';

const env = (overrides: Partial<EnvironmentVariables>): EnvironmentVariables =>
  Object.assign(new EnvironmentVariables(), overrides);

describe('productionViolations', () => {
  it('ignores non-production environments', () => {
    expect(productionViolations(env({ NODE_ENV: NodeEnv.Development, CORS_ORIGINS: '*' }))).toEqual(
      [],
    );
  });

  it('accepts a safe production configuration', () => {
    expect(
      productionViolations(
        env({ NODE_ENV: NodeEnv.Production, CORS_ORIGINS: 'https://app.example.test' }),
      ),
    ).toEqual([]);
  });

  it('rejects wildcard or plain-http CORS, simulated outages and weak hashing', () => {
    const violations = productionViolations(
      env({
        NODE_ENV: NodeEnv.Production,
        CORS_ORIGINS: '*,http://app.example.test',
        RISK_PROVIDER_FAILURE_RATE: 0.2,
        PASSWORD_HASH_ROUNDS: 8,
      }),
    );
    expect(violations).toHaveLength(4);
  });
});
