import { type CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { REQUEST_ID_HEADER } from '../common/constants';
import { type AppConfigService } from '../config/app-config.service';

const CORS_MAX_AGE_SECONDS = 600;
const LOCAL_DEVELOPMENT_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function isOriginAllowed(
  origin: string,
  allowList: readonly string[],
  allowLocalhost: boolean,
): boolean {
  return allowList.includes(origin) || (allowLocalhost && LOCAL_DEVELOPMENT_ORIGIN.test(origin));
}

export function buildCorsOptions(config: AppConfigService): CorsOptions {
  const { corsOrigins } = config.http;
  const allowLocalhost = !config.isProduction && corsOrigins.length === 0;
  return {
    origin: (origin, callback): void => {
      callback(null, origin === undefined || isOriginAllowed(origin, corsOrigins, allowLocalhost));
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', REQUEST_ID_HEADER],
    exposedHeaders: [REQUEST_ID_HEADER, 'Retry-After'],
    credentials: false,
    maxAge: CORS_MAX_AGE_SECONDS,
  };
}
