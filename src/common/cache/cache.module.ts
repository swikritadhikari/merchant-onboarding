import { Global, Logger, Module } from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfigService } from '../../config/app-config.service';
import { CacheService } from './cache.service';
import { CACHE_REDIS_CLIENT } from './constants';

function createCacheClient(config: AppConfigService): Redis {
  const client = new Redis({
    ...config.redis,
    keyPrefix: `${config.cache.keyPrefix}:`,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  const logger = new Logger('CacheRedis');
  let lastError = '';
  client.on('error', (error: Error) => {
    if (error.message !== lastError) {
      lastError = error.message;
      logger.warn(`Redis cache connection error: ${error.message}`);
    }
  });
  client.on('ready', () => {
    lastError = '';
  });
  return client;
}

@Global()
@Module({
  providers: [
    { provide: CACHE_REDIS_CLIENT, inject: [AppConfigService], useFactory: createCacheClient },
    CacheService,
  ],
  exports: [CacheService, CACHE_REDIS_CLIENT],
})
export class CacheModule {}
