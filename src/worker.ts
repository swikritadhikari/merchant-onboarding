import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createAppLogger, failStartup, installLifecycleHandlers } from './bootstrap';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const logger = createAppLogger();
  const app = await NestFactory.createApplicationContext(AppModule.register({ withWorker: true }), {
    logger,
  });

  installLifecycleHandlers({
    getApp: () => app,
    shutdownTimeoutMs: app.get(AppConfigService).shutdownTimeoutMs,
    logger,
  });

  logger.log('Risk review worker started', 'Bootstrap');
}

bootstrap().catch(failStartup);
