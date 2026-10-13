import { Injectable } from '@nestjs/common';
import { type DeepPartial, type FindOptionsWhere, In, LessThan } from 'typeorm';
import { type Page } from '../../common/interfaces';
import { BaseRepository, TransactionService } from '../../database';
import { MerchantApplication } from './entities';
import { ApplicationStatus } from './enums';
import { type ApplicationListFilter, type PendingSubmission } from './interfaces';

@Injectable()
export class ApplicationsRepository extends BaseRepository<MerchantApplication> {
  constructor(transactions: TransactionService) {
    super(transactions, MerchantApplication);
  }

  public create(data: DeepPartial<MerchantApplication>): Promise<MerchantApplication> {
    return this.repository.save(this.repository.create(data));
  }

  public save(application: MerchantApplication): Promise<MerchantApplication> {
    return this.repository.save(application);
  }

  public findById(id: string): Promise<MerchantApplication | null> {
    return this.repository.findOne({ where: { id } });
  }

  public findByIdForUpdate(id: string): Promise<MerchantApplication | null> {
    this.assertInTransaction('ApplicationsRepository.findByIdForUpdate');
    return this.repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  public async findPage(filter: ApplicationListFilter): Promise<Page<MerchantApplication>> {
    const where: FindOptionsWhere<MerchantApplication> = {};
    if (filter.createdById !== undefined) {
      where.createdById = filter.createdById;
    }
    if (filter.assignedReviewerId !== undefined) {
      where.assignedReviewerId = filter.assignedReviewerId;
    }
    if (filter.statuses !== undefined && filter.statuses.length > 0) {
      where.status = In([...filter.statuses]);
    }

    const [items, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: filter.offset,
      take: filter.limit,
    });
    return { items, total };
  }

  public async findStuckSubmissions(olderThan: Date, limit: number): Promise<PendingSubmission[]> {
    const rows = await this.repository.find({
      select: { id: true, submissionCount: true },
      where: { status: ApplicationStatus.Submitted, submittedAt: LessThan(olderThan) },
      order: { submittedAt: 'ASC' },
      take: limit,
    });
    return rows.map((row) => ({ applicationId: row.id, submissionNo: row.submissionCount }));
  }
}
