import { Logger } from '@nestjs/common';
import { type ThrottlerStorage } from '@nestjs/throttler';
import { type Redis } from 'ioredis';
import { describeError } from '../../utils';
import { THROTTLE_KEY_PREFIX } from '../constants';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const MILLISECONDS_PER_SECOND = 1000;
const ERROR_LOG_INTERVAL_MS = 30_000;

const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
local blocked = redis.call('PTTL', KEYS[2])
if blocked <= 0 and hits > tonumber(ARGV[2]) and tonumber(ARGV[3]) > 0 then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blocked = tonumber(ARGV[3])
end
if blocked < 0 then
  blocked = 0
end
return { hits, ttl, blocked }
`;

function isNumberTriple(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item: unknown) => typeof item === 'number')
  );
}

const toSeconds = (milliseconds: number): number =>
  Math.max(0, Math.ceil(milliseconds / MILLISECONDS_PER_SECOND));

export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private lastErrorLoggedAt = 0;

  constructor(private readonly redis: Redis) {}

  public async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitsKey = `${THROTTLE_KEY_PREFIX}${throttlerName}:${key}`;
    const blockKey = `${hitsKey}:blocked`;
    try {
      const result: unknown = await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        hitsKey,
        blockKey,
        ttl,
        limit,
        blockDuration,
      );
      if (!isNumberTriple(result)) {
        throw new Error('Unexpected throttle script result');
      }
      const [totalHits, ttlMs, blockedMs] = result;
      return {
        totalHits,
        timeToExpire: toSeconds(ttlMs),
        isBlocked: blockedMs > 0,
        timeToBlockExpire: toSeconds(blockedMs),
      };
    } catch (error: unknown) {
      this.logFailure(error);
      return { totalHits: 0, timeToExpire: toSeconds(ttl), isBlocked: false, timeToBlockExpire: 0 };
    }
  }

  private logFailure(error: unknown): void {
    const now = Date.now();
    if (now - this.lastErrorLoggedAt >= ERROR_LOG_INTERVAL_MS) {
      this.lastErrorLoggedAt = now;
      this.logger.warn(`Rate limiting unavailable, allowing request: ${describeError(error)}`);
    }
  }
}
