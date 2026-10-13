import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../users/enums';
import { AuditAction, AuditEntityType } from '../enums';

@Entity({ name: 'audit_logs' })
@Index('idx_audit_logs_entity', ['entityType', 'entityId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  public actorId!: string | null;

  @Column({ name: 'actor_role', type: 'varchar', length: 16, nullable: true })
  public actorRole!: Role | null;

  @Column({ type: 'varchar', length: 64 })
  public action!: AuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 64 })
  public entityType!: AuditEntityType;

  @Column({ name: 'entity_id', type: 'uuid' })
  public entityId!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  public metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;
}
