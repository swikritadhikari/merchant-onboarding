import { type EntityTarget, type ObjectLiteral, type Repository } from 'typeorm';
import { type TransactionService } from '../transaction.service';

export abstract class BaseRepository<T extends ObjectLiteral> {
  protected constructor(
    protected readonly transactions: TransactionService,
    private readonly target: EntityTarget<T>,
  ) {}

  protected get repository(): Repository<T> {
    return this.transactions.manager.getRepository(this.target);
  }

  protected assertInTransaction(operation: string): void {
    if (!this.transactions.isActive) {
      throw new Error(`${operation} must run inside TransactionService.run()`);
    }
  }
}
