import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  applyServerTimeouts,
  configureHttpApp,
  createAppLogger,
  failStartup,
  HTTP_APP_OPTIONS,
  installLifecycleHandlers,
  isWorkerEnabled,
  setupSwagger,
  SWAGGER_PATH,
} from './bootstrap';
import { ShutdownStateService } from './common/lifecycle';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const logger = createAppLogger();
  const withWorker = isWorkerEnabled();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register({ withWorker }), {
    ...HTTP_APP_OPTIONS,
    logger,
  });
  const config = app.get(AppConfigService);
  const shutdownState = app.get(ShutdownStateService);

  installLifecycleHandlers({
    getApp: () => app,
    shutdownTimeoutMs: config.shutdownTimeoutMs,
    logger,
    onShutdownStart: () => {
      shutdownState.begin();
    },
  });

  configureHttpApp(app, config);
  if (config.http.swaggerEnabled) {
    setupSwagger(app);
  }

  await app.listen(config.port);
  applyServerTimeouts(app, config.http.requestTimeoutMs);
  logger.log(
    `API listening on :${config.port} (env=${config.nodeEnv}, docs ${config.http.swaggerEnabled ? `at /${SWAGGER_PATH}` : 'disabled'}, in-process worker ${withWorker ? 'on' : 'off'})`,
    'Bootstrap',
  );
}

bootstrap().catch(failStartup);
