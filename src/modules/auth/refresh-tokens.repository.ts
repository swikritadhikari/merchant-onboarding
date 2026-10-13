import { Injectable } from '@nestjs/common';
import { In, IsNull } from 'typeorm';
import { BaseRepository, TransactionService } from '../../database';
import { RefreshToken } from './entities';
import { type RefreshTokenRevocationReason } from './enums';

interface FamilyIdRow {
  family_id: string;
}

@Injectable()
export class RefreshTokensRepository extends BaseRepository<RefreshToken> {
  constructor(transactions: TransactionService) {
    super(transactions, RefreshToken);
  }

  public findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repository.findOne({ where: { tokenHash } });
  }

  public findByHashForUpdate(tokenHash: string): Promise<RefreshToken | null> {
    this.assertInTransaction('RefreshTokensRepository.findByHashForUpdate');
    return this.repository.findOne({ where: { tokenHash }, lock: { mode: 'pessimistic_write' } });
  }

  public create(data: Omit<RefreshToken, 'id' | 'createdAt' | 'user'>): Promise<RefreshToken> {
    return this.repository.save(this.repository.create(data));
  }

  public save(token: RefreshToken): Promise<RefreshToken> {
    return this.repository.save(token);
  }

  public async revokeFamily(familyId: string, reason: RefreshTokenRevocationReason): Promise<void> {
    await this.repository.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date(), revokedReason: reason },
    );
  }

  public async revokeAllActiveForUser(
    userId: string,
    reason: RefreshTokenRevocationReason,
  ): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: () => 'now()', revokedReason: reason })
      .where('user_id = :userId AND revoked_at IS NULL', { userId })
      .returning(['familyId'])
      .execute();
    const rows = result.raw as FamilyIdRow[];
    return [...new Set(rows.map((row) => row.family_id))];
  }

  public existsInFamilyWithReason(
    familyId: string,
    reasons: readonly RefreshTokenRevocationReason[],
  ): Promise<boolean> {
    return this.repository.exists({ where: { familyId, revokedReason: In([...reasons]) } });
  }
}
