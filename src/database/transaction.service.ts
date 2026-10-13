import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

@Injectable()
export class TransactionService {
  private readonly storage = new AsyncLocalStorage<EntityManager>();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  public get manager(): EntityManager {
    return this.storage.getStore() ?? this.dataSource.manager;
  }

  public get isActive(): boolean {
    return this.storage.getStore() !== undefined;
  }

  public run<T>(work: () => Promise<T>): Promise<T> {
    if (this.isActive) {
      return work();
    }
    return this.dataSource.transaction((manager) => this.storage.run(manager, work));
  }
}
