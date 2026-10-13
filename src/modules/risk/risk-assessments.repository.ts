import { Injectable } from '@nestjs/common';
import { BaseRepository, TransactionService } from '../../database';
import { RiskAssessment } from './entities';
import { type NewRiskAssessment } from './interfaces';

@Injectable()
export class RiskAssessmentsRepository extends BaseRepository<RiskAssessment> {
  constructor(transactions: TransactionService) {
    super(transactions, RiskAssessment);
  }

  public async insertIfAbsent(assessment: NewRiskAssessment): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(RiskAssessment)
      .values(assessment)
      .orIgnore()
      .returning(['id'])
      .execute();
    const insertedRows = result.raw as unknown[];
    return insertedRows.length > 0;
  }
}
