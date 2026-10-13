import { Injectable } from '@nestjs/common';
import { BaseRepository, TransactionService } from '../../database';
import { AuditLog } from './entities';
import { type AuditEntityType } from './enums';

@Injectable()
export class AuditRepository extends BaseRepository<AuditLog> {
  constructor(transactions: TransactionService) {
    super(transactions, AuditLog);
  }

  public async append(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    await this.repository.save(this.repository.create(entry));
  }

  public findForEntity(entityType: AuditEntityType, entityId: string): Promise<AuditLog[]> {
    return this.repository.find({
      where: { entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }
}
