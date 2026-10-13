import { Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type Redis } from 'ioredis';
import { CACHE_REDIS_CLIENT, CACHE_SCAN_BATCH_SIZE } from './constants';
import { type CacheStats } from './interfaces';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly counters: CacheStats = { hit: 0, miss: 0, error: 0 };

  constructor(@Inject(CACHE_REDIS_CLIENT) private readonly redis: Redis) {}

  public get stats(): Readonly<CacheStats> {
    return { ...this.counters };
  }

  public async getOrLoad<T>(
    key: string,
    ttlSeconds: number,
    load: () => Promise<T | null>,
  ): Promise<T | null> {
    if (ttlSeconds <= 0) {
      return load();
    }

    const cached = await this.safely(() => this.redis.get(key));
    if (typeof cached === 'string') {
      const parsed = this.parse(key, cached);
      if (parsed !== undefined) {
        this.counters.hit++;
        return parsed as T;
      }
      await this.evict(key);
    }

    this.counters.miss++;
    const value = await load();
    if (value !== null) {
      await this.safely(() => this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds));
    }
    return value;
  }

  public async setWithTtl(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.safely(() => this.redis.set(key, value, 'EX', ttlSeconds));
    return result === 'OK';
  }

  public async exists(key: string): Promise<boolean | undefined> {
    const count = await this.safely(() => this.redis.exists(key));
    return count === undefined ? undefined : count > 0;
  }

  public async evict(...keys: string[]): Promise<void> {
    if (keys.length > 0) {
      await this.safely(() => this.redis.del(...keys));
    }
  }

  public async evictByPrefix(prefix: string): Promise<void> {
    const keyPrefix = this.redis.options.keyPrefix ?? '';
    await this.safely(async () => {
      let cursor = '0';
      do {
        const [next, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${keyPrefix}${prefix}*`,
          'COUNT',
          CACHE_SCAN_BATCH_SIZE,
        );
        cursor = next;
        if (keys.length > 0) {
          await this.redis.del(...keys.map((key) => key.slice(keyPrefix.length)));
        }
      } while (cursor !== '0');
    });
  }

  public async ping(): Promise<boolean> {
    const reply = await this.safely(() => this.redis.ping());
    return reply === 'PONG';
  }

  public async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  private parse(key: string, raw: string): unknown {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      this.counters.error++;
      this.logger.warn(`Discarding unreadable cache entry ${key}`);
      return undefined;
    }
  }

  private async safely<T>(operation: () => Promise<T>): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error: unknown) {
      this.counters.error++;
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Cache unavailable, falling back to source: ${reason}`);
      return undefined;
    }
  }
}
