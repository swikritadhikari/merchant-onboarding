import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities';
import { RefreshTokenRevocationReason } from '../enums';

@Entity({ name: 'refresh_tokens' })
@Index('idx_refresh_tokens_family', ['familyId'])
@Index('idx_refresh_tokens_user', ['userId'])
@Check(
  'chk_refresh_tokens_revoked_reason',
  `"revoked_reason" IS NULL OR "revoked_reason" IN ('ROTATED', 'LOGOUT', 'REUSE_DETECTED', 'USER_INACTIVE')`,
)
@Check(
  'chk_refresh_tokens_revocation_fields',
  `("revoked_at" IS NULL) = ("revoked_reason" IS NULL)`,
)
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Index('uq_refresh_tokens_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  public tokenHash!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_refresh_tokens_user' })
  public user?: User;

  @Column({ name: 'family_id', type: 'uuid' })
  public familyId!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  public expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  public revokedAt!: Date | null;

  @Column({ name: 'revoked_reason', type: 'varchar', length: 32, nullable: true })
  public revokedReason!: RefreshTokenRevocationReason | null;

  @Column({ name: 'replaced_by_id', type: 'uuid', nullable: true })
  public replacedById!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;
}
