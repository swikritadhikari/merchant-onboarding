import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { RiskModule } from '../risk/risk.module';
import { UsersModule } from '../users/users.module';
import { ApplicationsController } from './applications.controller';
import { ApplicationsRepository } from './applications.repository';
import { ApplicationsService } from './applications.service';

@Module({
  imports: [AuditModule, UsersModule, RiskModule],
  controllers: [ApplicationsController],
  providers: [ApplicationsRepository, ApplicationsService],
  exports: [ApplicationsRepository],
})
export class ApplicationsModule {}
