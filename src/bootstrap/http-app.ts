import { type NestApplicationOptions, ValidationPipe, VersioningType } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import helmet from 'helmet';
import {
  API_DEFAULT_VERSION,
  API_PREFIX,
  HEALTH_ROUTES,
  JSON_BODY_LIMIT,
} from '../common/constants';
import {
  createHttpErrorMiddleware,
  jsonContentTypeMiddleware,
  noStoreMiddleware,
  requestIdMiddleware,
} from '../common/middleware';
import { validationExceptionFactory } from '../common/validation';
import { type AppConfigService } from '../config/app-config.service';
import { buildCorsOptions } from './cors';

const HSTS_MAX_AGE_SECONDS = 180 * 24 * 3600;

export const HTTP_APP_OPTIONS: NestApplicationOptions = { bodyParser: false };

export function configureHttpApp(app: NestExpressApplication, config: AppConfigService): void {
  app.set('trust proxy', config.http.trustProxy);
  app.disable('x-powered-by');

  app.use(requestIdMiddleware);
  app.enableCors(buildCorsOptions(config));
  app.use(
    helmet({
      hsts: config.isProduction
        ? { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true, preload: false }
        : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(noStoreMiddleware);
  app.use(jsonContentTypeMiddleware);
  app.use(json({ limit: JSON_BODY_LIMIT }));
  app.use(createHttpErrorMiddleware(config.isDevelopment));

  app.setGlobalPrefix(API_PREFIX, { exclude: [...HEALTH_ROUTES] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: API_DEFAULT_VERSION });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: validationExceptionFactory,
    }),
  );
}

export function applyServerTimeouts(app: NestExpressApplication, requestTimeoutMs: number): void {
  const server = app.getHttpServer();
  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = Math.min(requestTimeoutMs, server.headersTimeout);
}
