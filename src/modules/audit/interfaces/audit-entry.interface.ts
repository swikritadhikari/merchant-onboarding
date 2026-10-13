import { type AuthenticatedUser } from '../../auth/interfaces';
import { type AuditAction, type AuditEntityType } from '../enums';

export type AuditActor = Pick<AuthenticatedUser, 'id' | 'role'>;

export interface AuditEntry {
  actor: AuditActor | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}
