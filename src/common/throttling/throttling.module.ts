import { Global, Module } from '@nestjs/common';
import { ThrottlerModule, type ThrottlerModuleOptions } from '@nestjs/throttler';
import { type Redis } from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';
import { CACHE_REDIS_CLIENT } from '../cache';
import { AUTH_THROTTLER, DEFAULT_THROTTLER, RATE_LIMIT_WINDOW_MS } from './constants';
import { RedisThrottlerStorage } from './storage';
import { isAuthRateLimited } from './utils';

@Global()
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService, CACHE_REDIS_CLIENT],
      useFactory: (config: AppConfigService, redis: Redis): ThrottlerModuleOptions => ({
        throttlers: [
          {
            name: DEFAULT_THROTTLER,
            ttl: RATE_LIMIT_WINDOW_MS,
            limit: config.http.rateLimitPerMinute,
          },
          {
            name: AUTH_THROTTLER,
            ttl: RATE_LIMIT_WINDOW_MS,
            limit: config.http.authRateLimitPerMinute,
            skipIf: (context) => !isAuthRateLimited(context),
          },
        ],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class ThrottlingModule {}
