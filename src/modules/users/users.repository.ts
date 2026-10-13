import { Injectable } from '@nestjs/common';
import { type DeepPartial } from 'typeorm';
import { BaseRepository, TransactionService } from '../../database';
import { User } from './entities';
import { type Role } from './enums';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(transactions: TransactionService) {
    super(transactions, User);
  }

  public findActiveByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .andWhere('user.isActive = true')
      .getOne();
  }

  public findActiveById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id, isActive: true } });
  }

  public findActiveByIdAndRole(id: string, role: Role): Promise<User | null> {
    return this.repository.findOne({ where: { id, role, isActive: true } });
  }

  public findByIdForUpdate(id: string): Promise<User | null> {
    this.assertInTransaction('UsersRepository.findByIdForUpdate');
    return this.repository.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
  }

  public findActive(role?: Role): Promise<User[]> {
    return this.repository.find({
      where: role === undefined ? { isActive: true } : { isActive: true, role },
      order: { fullName: 'ASC' },
    });
  }

  public create(data: DeepPartial<User>): Promise<User> {
    return this.repository.save(this.repository.create(data));
  }

  public save(user: User): Promise<User> {
    return this.repository.save(user);
  }
}
