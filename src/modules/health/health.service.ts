import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/cache';
import { ShutdownStateService } from '../../common/lifecycle';
import { type HealthResponseDto } from './dto';
import { DependencyStatus, HealthStatus } from './enums';
import { HealthRepository } from './health.repository';

const toStatus = (up: boolean): DependencyStatus =>
  up ? DependencyStatus.Up : DependencyStatus.Down;

@Injectable()
export class HealthService {
  constructor(
    private readonly healthRepository: HealthRepository,
    private readonly cache: CacheService,
    private readonly shutdownState: ShutdownStateService,
  ) {}

  public liveness(): HealthResponseDto {
    return { status: HealthStatus.Ok };
  }

  public async readiness(): Promise<HealthResponseDto> {
    const [databaseUp, redisUp] = await Promise.all([
      this.healthRepository.ping(),
      this.cache.ping(),
    ]);
    const shuttingDown = this.shutdownState.isShuttingDown;
    const ready = databaseUp && redisUp && !shuttingDown;
    return {
      status: ready ? HealthStatus.Ok : HealthStatus.Unavailable,
      checks: { database: toStatus(databaseUp), redis: toStatus(redisUp), shuttingDown },
    };
  }
}
