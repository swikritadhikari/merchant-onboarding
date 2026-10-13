import { type INestApplicationContext, Logger } from '@nestjs/common';
import { type ClosableServer, type LifecycleOptions } from './interfaces';

const EXIT_OK = 0;
const EXIT_FAILURE = 1;

type ShutdownSignal = 'SIGINT' | 'SIGTERM';

export interface LifecycleController {
  shutdown(reason: string, exitCode: number): Promise<void>;
}

export function installLifecycleHandlers(options: LifecycleOptions): LifecycleController {
  const target = options.process ?? process;
  const exit = options.exit ?? ((code: number): void => process.exit(code));
  const { logger } = options;
  let shuttingDown = false;

  const shutdown = async (reason: string, exitCode: number): Promise<void> => {
    if (shuttingDown) {
      logger.warn(`Second shutdown request (${reason}); exiting immediately`);
      exit(EXIT_FAILURE);
      return;
    }
    shuttingDown = true;
    logger.log(`Shutting down: ${reason}`);
    options.onShutdownStart?.();

    const deadline = setTimeout(() => {
      logger.error(`Graceful shutdown exceeded ${options.shutdownTimeoutMs}ms; forcing exit`);
      exit(EXIT_FAILURE);
    }, options.shutdownTimeoutMs);
    deadline.unref();

    try {
      await closeApp(options.getApp());
      logger.log('Shutdown complete');
      exit(exitCode);
    } catch (error: unknown) {
      logger.error('Error during shutdown', error instanceof Error ? error.stack : String(error));
      exit(EXIT_FAILURE);
    } finally {
      clearTimeout(deadline);
    }
  };

  const onSignal = (signal: ShutdownSignal) => (): void => {
    void shutdown(`received ${signal}`, EXIT_OK);
  };

  target.on('SIGINT', onSignal('SIGINT'));
  target.on('SIGTERM', onSignal('SIGTERM'));
  target.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', error.stack);
    void shutdown('uncaught exception', EXIT_FAILURE);
  });
  target.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('Unhandled promise rejection', error.stack);
    void shutdown('unhandled promise rejection', EXIT_FAILURE);
  });

  return { shutdown };
}

async function closeApp(app: INestApplicationContext | undefined): Promise<void> {
  if (app === undefined) {
    return;
  }
  const server = hasHttpServer(app) ? app.getHttpServer() : undefined;
  if (isClosableServer(server)) {
    server.closeIdleConnections();
  }
  await app.close();
}

function hasHttpServer(
  app: INestApplicationContext,
): app is INestApplicationContext & { getHttpServer: () => unknown } {
  return 'getHttpServer' in app && typeof app.getHttpServer === 'function';
}

function isClosableServer(server: unknown): server is ClosableServer {
  return (
    typeof server === 'object' &&
    server !== null &&
    'closeIdleConnections' in server &&
    typeof server.closeIdleConnections === 'function'
  );
}

export function failStartup(error: unknown): void {
  new Logger('Bootstrap').error(
    'Failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(EXIT_FAILURE);
}
