import { Injectable } from '@nestjs/common';
import { TransactionService } from '../../database';

@Injectable()
export class HealthRepository {
  constructor(private readonly transactions: TransactionService) {}

  public async ping(): Promise<boolean> {
    try {
      await this.transactions.manager.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
