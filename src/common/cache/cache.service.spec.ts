import { Logger } from '@nestjs/common';
import { type Redis } from 'ioredis';
import { CacheService } from './cache.service';

const fakeRedis = () => {
  const store = new Map<string, string>();
  return {
    store,
    options: { keyPrefix: 'p:' },
    get: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set: jest.fn((k: string, v: string) => {
      store.set(k, v);
      return Promise.resolve('OK');
    }),
    del: jest.fn((...keys: string[]) => {
      keys.forEach((k) => store.delete(k));
      return Promise.resolve(keys.length);
    }),
    exists: jest.fn((k: string) => Promise.resolve(store.has(k) ? 1 : 0)),
    scan: jest.fn((): Promise<[string, string[]]> =>
      Promise.resolve(['0', [...store.keys()].map((k) => `p:${k}`)]),
    ),
    quit: jest.fn(() => Promise.resolve('OK')),
    disconnect: jest.fn(),
  };
};

describe('CacheService', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  it('loads on a miss, stores with a TTL and serves the next read from cache', async () => {
    const redis = fakeRedis();
    const cache = new CacheService(redis as unknown as Redis);
    const load = jest.fn().mockResolvedValue({ id: 'u1' });

    expect(await cache.getOrLoad('user:u1', 60, load)).toEqual({ id: 'u1' });
    expect(await cache.getOrLoad('user:u1', 60, load)).toEqual({ id: 'u1' });

    expect(load).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith('user:u1', '{"id":"u1"}', 'EX', 60);
    expect(cache.stats).toMatchObject({ hit: 1, miss: 1 });
  });

  it('does not cache null so a missing record is re-checked next time', async () => {
    const redis = fakeRedis();
    const cache = new CacheService(redis as unknown as Redis);
    const load = jest.fn().mockResolvedValue(null);

    await cache.getOrLoad('user:gone', 60, load);
    await cache.getOrLoad('user:gone', 60, load);

    expect(load).toHaveBeenCalledTimes(2);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('bypasses the cache entirely when the TTL is zero', async () => {
    const redis = fakeRedis();
    const cache = new CacheService(redis as unknown as Redis);

    await cache.getOrLoad('k', 0, () => Promise.resolve(1));

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('falls back to the source when Redis is unavailable', async () => {
    const redis = fakeRedis();
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    const cache = new CacheService(redis as unknown as Redis);

    await expect(cache.getOrLoad('k', 60, () => Promise.resolve('fresh'))).resolves.toBe('fresh');
    expect(cache.stats.error).toBe(2);
  });

  it('evicts by key and by prefix, stripping the client key prefix', async () => {
    const redis = fakeRedis();
    redis.store.set('users:list:all', '[]');
    redis.store.set('users:list:REVIEWER', '[]');
    redis.store.set('principal:u1', '{}');
    const cache = new CacheService(redis as unknown as Redis);

    await cache.evict('principal:u1');
    redis.scan.mockResolvedValueOnce(['0', ['p:users:list:all', 'p:users:list:REVIEWER']]);
    await cache.evictByPrefix('users:list:');

    expect([...redis.store.keys()]).toEqual([]);
  });

  it('reports key existence, and "unknown" instead of "false" when Redis fails', async () => {
    const redis = fakeRedis();
    const cache = new CacheService(redis as unknown as Redis);

    expect(await cache.setWithTtl('flag', '1', 30)).toBe(true);
    expect(redis.set).toHaveBeenCalledWith('flag', '1', 'EX', 30);
    expect(await cache.exists('flag')).toBe(true);
    expect(await cache.exists('other')).toBe(false);

    redis.exists.mockRejectedValue(new Error('ECONNREFUSED'));
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await cache.exists('flag')).toBeUndefined();
    expect(await cache.setWithTtl('flag', '1', 30)).toBe(false);
  });

  it('discards a corrupted entry and reloads from the source', async () => {
    const redis = fakeRedis();
    redis.store.set('user:u1', '{not json');
    const cache = new CacheService(redis as unknown as Redis);
    const load = jest.fn().mockResolvedValue({ id: 'u1' });

    await expect(cache.getOrLoad('user:u1', 60, load)).resolves.toEqual({ id: 'u1' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(redis.store.get('user:u1')).toBe('{"id":"u1"}');
  });
});
