import { type INestApplicationContext, type LoggerService } from '@nestjs/common';

export interface ProcessLike {
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  on(event: 'uncaughtException', listener: (error: Error) => void): unknown;
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): unknown;
}

export interface LifecycleOptions {
  getApp: () => INestApplicationContext | undefined;
  shutdownTimeoutMs: number;
  logger: LoggerService;
  onShutdownStart?: () => void;
  process?: ProcessLike;
  exit?: (code: number) => void;
}

export interface ClosableServer {
  closeIdleConnections: () => void;
}
