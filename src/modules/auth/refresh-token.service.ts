import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { TransactionService } from '../../database';
import { UsersService } from '../users/users.service';
import { REFRESH_TOKEN_BYTES } from './constants';
import { RefreshTokenRevocationReason, SESSION_ENDING_REASONS } from './enums';
import {
  type IssuedRefreshToken,
  type PersistedRefreshToken,
  type RotationResult,
} from './interfaces';
import { RefreshTokensRepository } from './refresh-tokens.repository';
import { hashRefreshToken } from './utils';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly refreshTokensRepository: RefreshTokensRepository,
    private readonly usersService: UsersService,
    private readonly transactions: TransactionService,
    private readonly config: AppConfigService,
  ) {}

  public async issue(userId: string): Promise<IssuedRefreshToken> {
    const { issued } = await this.persistToken(userId, randomUUID());
    return issued;
  }

  public rotate(rawToken: string): Promise<RotationResult> {
    return this.transactions.run(async (): Promise<RotationResult> => {
      const current = await this.refreshTokensRepository.findByHashForUpdate(
        hashRefreshToken(rawToken),
      );
      if (!current) {
        return { ok: false, reason: 'unknown' };
      }

      if (current.revokedAt !== null) {
        if (current.revokedReason !== RefreshTokenRevocationReason.Rotated) {
          return { ok: false, reason: 'revoked' };
        }
        await this.refreshTokensRepository.revokeFamily(
          current.familyId,
          RefreshTokenRevocationReason.ReuseDetected,
        );
        this.logger.warn(
          `Refresh token reuse detected for user ${current.userId}; session ${current.familyId} revoked`,
        );
        return { ok: false, reason: 'reused', revokedSessionId: current.familyId };
      }

      if (current.expiresAt.getTime() <= Date.now()) {
        return { ok: false, reason: 'expired' };
      }

      const user = await this.usersService.findActiveById(current.userId);
      if (!user) {
        await this.refreshTokensRepository.revokeFamily(
          current.familyId,
          RefreshTokenRevocationReason.UserInactive,
        );
        return { ok: false, reason: 'user_inactive', revokedSessionId: current.familyId };
      }

      const next = await this.persistToken(user.id, current.familyId);
      current.revokedAt = new Date();
      current.revokedReason = RefreshTokenRevocationReason.Rotated;
      current.replacedById = next.id;
      await this.refreshTokensRepository.save(current);

      return { ok: true, user, refreshToken: next.issued };
    });
  }

  public revokeSession(rawToken: string): Promise<string | null> {
    return this.transactions.run(async () => {
      const token = await this.refreshTokensRepository.findByHash(hashRefreshToken(rawToken));
      if (!token) {
        return null;
      }
      await this.refreshTokensRepository.revokeFamily(
        token.familyId,
        RefreshTokenRevocationReason.Logout,
      );
      return token.familyId;
    });
  }

  public revokeAllSessions(userId: string): Promise<string[]> {
    return this.refreshTokensRepository.revokeAllActiveForUser(
      userId,
      RefreshTokenRevocationReason.Logout,
    );
  }

  public isSessionRevoked(sessionId: string): Promise<boolean> {
    return this.refreshTokensRepository.existsInFamilyWithReason(sessionId, SESSION_ENDING_REASONS);
  }

  private async persistToken(userId: string, familyId: string): Promise<PersistedRefreshToken> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + this.config.refreshToken.expiresInSeconds * 1000);
    const entity = await this.refreshTokensRepository.create({
      tokenHash: hashRefreshToken(token),
      userId,
      familyId,
      expiresAt,
      revokedAt: null,
      revokedReason: null,
      replacedById: null,
    });
    return { id: entity.id, issued: { token, expiresAt, sessionId: familyId } };
  }
}
