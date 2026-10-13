import { Logger } from '@nestjs/common';
import { type Redis } from 'ioredis';
import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('RedisThrottlerStorage', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  const storageWith = (evalImpl: jest.Mock): RedisThrottlerStorage =>
    new RedisThrottlerStorage({ eval: evalImpl } as unknown as Redis);

  it('namespaces keys per throttler and converts milliseconds to seconds', async () => {
    const evalMock = jest.fn().mockResolvedValue([3, 41_500, 0]);
    const record = await storageWith(evalMock).increment('client-key', 60_000, 10, 60_000, 'auth');

    expect(evalMock).toHaveBeenCalledWith(
      expect.any(String),
      2,
      'throttle:auth:client-key',
      'throttle:auth:client-key:blocked',
      60_000,
      10,
      60_000,
    );
    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 42,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('reports a block while the block key is alive', async () => {
    const record = await storageWith(jest.fn().mockResolvedValue([11, 30_000, 59_001])).increment(
      'k',
      60_000,
      10,
      60_000,
      'default',
    );
    expect(record).toMatchObject({ isBlocked: true, timeToBlockExpire: 60 });
  });

  it('fails open when Redis is unavailable', async () => {
    const record = await storageWith(
      jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    ).increment('k', 60_000, 10, 60_000, 'default');
    expect(record).toEqual({
      totalHits: 0,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('fails open on an unexpected script result', async () => {
    const record = await storageWith(jest.fn().mockResolvedValue('nonsense')).increment(
      'k',
      1000,
      1,
      1000,
      'default',
    );
    expect(record.isBlocked).toBe(false);
  });
});
