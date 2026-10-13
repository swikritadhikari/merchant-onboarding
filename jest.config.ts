import type { Config } from 'jest';

const shared = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  testEnvironment: 'node',
};

const config: Config = {
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/worker.ts', '!src/database/**'],
  coverageDirectory: 'coverage',
  testTimeout: 30000,
  projects: [
    {
      ...shared,
      displayName: 'unit',
      rootDir: 'src',
      testRegex: '.*\\.spec\\.ts$',
    },
    {
      ...shared,
      displayName: 'integration',
      rootDir: '.',
      testRegex: 'test/.*\\.e2e-spec\\.ts$',
      setupFiles: ['<rootDir>/test/setup-env.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
    },
  ],
};

export default config;
