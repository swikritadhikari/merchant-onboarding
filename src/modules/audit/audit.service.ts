import { Injectable } from '@nestjs/common';
import { redact } from '../../common/security';
import { AuditRepository } from './audit.repository';
import { type AuditLog } from './entities';
import { type AuditEntityType } from './enums';
import { type AuditEntry } from './interfaces';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  public record(entry: AuditEntry): Promise<void> {
    return this.auditRepository.append({
      actorId: entry.actor?.id ?? null,
      actorRole: entry.actor?.role ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: redact(entry.metadata ?? {}),
    });
  }

  public findForEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLog[]> {
    return this.auditRepository.findForEntity(entityType, entityId);
  }
}
