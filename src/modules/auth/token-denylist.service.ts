import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../../common/cache';
import { AppConfigService } from '../../config/app-config.service';
import { DENYLIST_CLOCK_SKEW_SECONDS, sessionDenylistKey } from './constants';
import { RefreshTokenService } from './refresh-token.service';

@Injectable()
export class TokenDenylistService {
  private readonly logger = new Logger(TokenDenylistService.name);

  constructor(
    private readonly cache: CacheService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly config: AppConfigService,
  ) {}

  public async denySessions(sessionIds: readonly string[]): Promise<void> {
    const ttlSeconds = this.config.jwt.expiresInSeconds + DENYLIST_CLOCK_SKEW_SECONDS;
    for (const sessionId of sessionIds) {
      const stored = await this.cache.setWithTtl(sessionDenylistKey(sessionId), '1', ttlSeconds);
      if (!stored) {
        this.logger.error(
          `Could not write denylist entry for session ${sessionId}; checks fall back to the database while Redis is unavailable`,
        );
      }
    }
  }

  public async isSessionDenied(sessionId: string): Promise<boolean> {
    const flagged = await this.cache.exists(sessionDenylistKey(sessionId));
    if (flagged !== undefined) {
      return flagged;
    }
    return this.refreshTokenService.isSessionRevoked(sessionId);
  }
}
