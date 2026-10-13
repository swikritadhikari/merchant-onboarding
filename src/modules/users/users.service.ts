import { Injectable } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/enums';
import { type AuthenticatedUser } from '../auth/interfaces';
import { CacheService } from '../../common/cache';
import { BusinessRuleViolationError, ResourceNotFoundError } from '../../common/errors';
import { AppConfigService } from '../../config/app-config.service';
import { TransactionService } from '../../database';
import { principalCacheKey, USERS_LIST_CACHE_PREFIX, usersListCacheKey } from './constants';
import { type UpdateUserDto, UserResponseDto } from './dto';
import { type User } from './entities';
import { type Role } from './enums';
import { type CreateUserInput, type FieldChange } from './interfaces';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly transactions: TransactionService,
    private readonly cache: CacheService,
    private readonly auditService: AuditService,
    private readonly config: AppConfigService,
  ) {}

  public findActiveByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository.findActiveByEmailWithPassword(email.trim().toLowerCase());
  }

  public findActiveById(id: string): Promise<User | null> {
    return this.usersRepository.findActiveById(id);
  }

  public findActiveByIdAndRole(id: string, role: Role): Promise<User | null> {
    return this.usersRepository.findActiveByIdAndRole(id, role);
  }

  public findActivePrincipal(id: string): Promise<AuthenticatedUser | null> {
    return this.cache.getOrLoad<AuthenticatedUser>(
      principalCacheKey(id),
      this.config.cache.principalTtlSeconds,
      async () => {
        const user = await this.usersRepository.findActiveById(id);
        return user ? { id: user.id, email: user.email, role: user.role } : null;
      },
    );
  }

  public async list(role?: Role): Promise<UserResponseDto[]> {
    const users = await this.cache.getOrLoad<UserResponseDto[]>(
      usersListCacheKey(role),
      this.config.cache.usersListTtlSeconds,
      async () => {
        const rows = await this.usersRepository.findActive(role);
        return rows.map((user) => UserResponseDto.from(user));
      },
    );
    return users ?? [];
  }

  public async create(input: CreateUserInput): Promise<User> {
    const user = await this.usersRepository.create({
      email: input.email.trim().toLowerCase(),
      fullName: input.fullName,
      role: input.role,
      passwordHash: await hash(input.password, this.config.passwordHashRounds),
    });
    await this.cache.evictByPrefix(USERS_LIST_CACHE_PREFIX);
    return user;
  }

  public async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): Promise<User> {
    this.assertNotSelfLockout(id, dto, actor);

    const updated = await this.transactions.run(async () => {
      const user = await this.usersRepository.findByIdForUpdate(id);
      if (!user) {
        throw new ResourceNotFoundError('User');
      }

      const changes: Record<string, FieldChange<unknown>> = {};
      if (dto.role !== undefined && dto.role !== user.role) {
        changes.role = { from: user.role, to: dto.role };
        user.role = dto.role;
      }
      if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
        changes.isActive = { from: user.isActive, to: dto.isActive };
        user.isActive = dto.isActive;
      }
      if (Object.keys(changes).length === 0) {
        return user;
      }

      const saved = await this.usersRepository.save(user);
      await this.auditService.record({
        actor,
        action: AuditAction.UserUpdated,
        entityType: AuditEntityType.User,
        entityId: user.id,
        metadata: { changes },
      });
      return saved;
    });

    await this.cache.evict(principalCacheKey(id));
    await this.cache.evictByPrefix(USERS_LIST_CACHE_PREFIX);
    return updated;
  }

  private assertNotSelfLockout(id: string, dto: UpdateUserDto, actor: AuthenticatedUser): void {
    const deactivatesSelf = dto.isActive === false;
    const demotesSelf = dto.role !== undefined && dto.role !== actor.role;
    if (id === actor.id && (deactivatesSelf || demotesSelf)) {
      throw new BusinessRuleViolationError('Administrators cannot deactivate or demote themselves');
    }
  }
}
