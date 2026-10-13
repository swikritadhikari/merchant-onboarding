import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/applications.module';
import { AuditModule } from '../audit/audit.module';
import { RISK_PROVIDER } from './constants';
import { RiskReviewProcessor } from './processors';
import { SimulatedRiskProvider } from './providers';
import { RiskAssessmentsRepository } from './risk-assessments.repository';
import { RiskReviewService } from './risk-review.service';
import { RiskModule } from './risk.module';

@Module({
  imports: [RiskModule, ApplicationsModule, AuditModule],
  providers: [
    RiskAssessmentsRepository,
    RiskReviewService,
    RiskReviewProcessor,
    { provide: RISK_PROVIDER, useClass: SimulatedRiskProvider },
  ],
  exports: [RiskReviewService],
})
export class RiskWorkerModule {}
