import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { NodeEnv } from '../config/enums';

const LOG_LEVELS: Readonly<Record<NodeEnv, LogLevel[]>> = {
  [NodeEnv.Production]: ['fatal', 'error', 'warn', 'log'],
  [NodeEnv.Development]: ['fatal', 'error', 'warn', 'log', 'debug', 'verbose'],
  [NodeEnv.Test]: ['fatal', 'error'],
};

function nodeEnvFrom(value: string | undefined): NodeEnv {
  return Object.values(NodeEnv).find((env) => env === value) ?? NodeEnv.Development;
}

export function createAppLogger(env: NodeJS.ProcessEnv = process.env): ConsoleLogger {
  const nodeEnv = nodeEnvFrom(env.NODE_ENV);
  const production = nodeEnv === NodeEnv.Production;
  return new ConsoleLogger({
    logLevels: LOG_LEVELS[nodeEnv],
    json: production,
    colors: !production,
  });
}
