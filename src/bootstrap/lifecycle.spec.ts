import { EventEmitter } from 'events';
import { type INestApplicationContext, type LoggerService } from '@nestjs/common';
import { installLifecycleHandlers } from './lifecycle';

const silentLogger: LoggerService = { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

function setup(close: () => Promise<void> = () => Promise.resolve()) {
  const emitter = new EventEmitter();
  const exit = jest.fn();
  const onShutdownStart = jest.fn();
  const app = { close: jest.fn(close) } as unknown as INestApplicationContext;
  installLifecycleHandlers({
    getApp: () => app,
    shutdownTimeoutMs: 50,
    logger: silentLogger,
    onShutdownStart,
    process: emitter,
    exit,
  });
  return { emitter, exit, onShutdownStart, app };
}

describe('installLifecycleHandlers', () => {
  it.each(['SIGTERM', 'SIGINT'])('closes the app gracefully on %s and exits 0', async (signal) => {
    const { emitter, exit, onShutdownStart, app } = setup();

    emitter.emit(signal);
    await flush();

    expect(onShutdownStart).toHaveBeenCalledTimes(1);
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits immediately with 1 on a second signal', async () => {
    const { emitter, exit, app } = setup(() => new Promise(() => undefined));

    emitter.emit('SIGTERM');
    emitter.emit('SIGTERM');
    await flush();

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('forces exit when graceful shutdown exceeds the deadline', async () => {
    const { emitter, exit } = setup(() => new Promise(() => undefined));

    emitter.emit('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 80));

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('shuts down with exit code 1 on fatal errors', async () => {
    const rejection = setup();
    rejection.emitter.emit('unhandledRejection', new Error('boom'));
    await flush();
    expect(rejection.exit).toHaveBeenCalledWith(1);

    const exception = setup();
    exception.emitter.emit('uncaughtException', new Error('boom'));
    await flush();
    expect(exception.exit).toHaveBeenCalledWith(1);
  });

  it('exits 1 when closing the app fails', async () => {
    const { emitter, exit } = setup(() => Promise.reject(new Error('close failed')));

    emitter.emit('SIGTERM');
    await flush();

    expect(exit).toHaveBeenCalledWith(1);
  });
});
