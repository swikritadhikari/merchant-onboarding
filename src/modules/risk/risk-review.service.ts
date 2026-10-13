import { Inject, Injectable, Logger } from '@nestjs/common';
import { ApplicationsRepository } from '../applications/applications.repository';
import { transition } from '../applications/domain';
import { type MerchantApplication } from '../applications/entities';
import { ApplicationAction, ApplicationStatus, RiskStatus } from '../applications/enums';
import { type PendingSubmission } from '../applications/interfaces';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/enums';
import { isAbortError } from '../../common/utils';
import { AppConfigService } from '../../config/app-config.service';
import { TransactionService } from '../../database';
import { RISK_PROVIDER } from './constants';
import { RiskLevel } from './enums';
import { RiskProviderError } from './errors';
import {
  type AssessJobData,
  type AssessOutcome,
  type RiskAssessmentRequest,
  type RiskAssessmentResult,
  type RiskProvider,
} from './interfaces';
import { RiskAssessmentsRepository } from './risk-assessments.repository';

const RISK_STATUS_BY_LEVEL: Readonly<Record<RiskLevel, RiskStatus>> = {
  [RiskLevel.Low]: RiskStatus.Low,
  [RiskLevel.Medium]: RiskStatus.Medium,
  [RiskLevel.High]: RiskStatus.High,
};

@Injectable()
export class RiskReviewService {
  private readonly logger = new Logger(RiskReviewService.name);

  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly riskAssessmentsRepository: RiskAssessmentsRepository,
    private readonly transactions: TransactionService,
    private readonly auditService: AuditService,
    private readonly config: AppConfigService,
    @Inject(RISK_PROVIDER) private readonly provider: RiskProvider,
  ) {}

  public async assess(job: AssessJobData, attempt: number): Promise<AssessOutcome> {
    const application = await this.applicationsRepository.findById(job.applicationId);
    if (!application) {
      this.logger.warn(`Application ${job.applicationId} no longer exists; dropping job`);
      return { outcome: 'skipped', reason: 'not_found' };
    }
    if (!this.isAwaitingSubmission(application, job)) {
      return { outcome: 'skipped', reason: 'stale_submission' };
    }

    const result = await this.callProvider({
      idempotencyKey: `${job.applicationId}:${job.submissionNo}`,
      legalBusinessName: application.legalBusinessName,
      businessType: application.businessType,
      taxId: application.taxId,
      mcc: application.processing.mcc,
      monthlyVolumeMinor: application.processing.monthlyVolumeMinor,
    });

    return this.transactions.run(async (): Promise<AssessOutcome> => {
      const locked = await this.applicationsRepository.findByIdForUpdate(job.applicationId);
      if (!locked || !this.isAwaitingSubmission(locked, job)) {
        return { outcome: 'skipped', reason: 'stale_submission' };
      }

      const inserted = await this.riskAssessmentsRepository.insertIfAbsent({
        applicationId: job.applicationId,
        submissionNo: job.submissionNo,
        provider: result.provider,
        providerReference: result.providerReference,
        score: result.score,
        riskLevel: result.level,
        reasons: result.reasons,
        attempt,
      });
      if (!inserted) {
        return { outcome: 'skipped', reason: 'already_assessed' };
      }

      locked.status = transition(locked.status, ApplicationAction.CompleteRiskReview);
      locked.riskStatus = RISK_STATUS_BY_LEVEL[result.level];
      locked.riskScore = result.score;
      locked.riskAssessedAt = new Date();
      await this.applicationsRepository.save(locked);

      await this.auditService.record({
        actor: null,
        action: AuditAction.RiskReviewCompleted,
        entityType: AuditEntityType.MerchantApplication,
        entityId: locked.id,
        metadata: {
          submissionNo: job.submissionNo,
          riskLevel: result.level,
          score: result.score,
          reasons: result.reasons,
          providerReference: result.providerReference,
          attempt,
        },
      });

      return { outcome: 'completed', riskLevel: result.level, score: result.score };
    });
  }

  public markFailed(job: AssessJobData, reason: string): Promise<boolean> {
    return this.transactions.run(async () => {
      const locked = await this.applicationsRepository.findByIdForUpdate(job.applicationId);
      if (!locked || !this.isAwaitingSubmission(locked, job)) {
        return false;
      }

      locked.status = transition(locked.status, ApplicationAction.FailRiskReview);
      locked.riskStatus = RiskStatus.Error;
      await this.applicationsRepository.save(locked);

      await this.auditService.record({
        actor: null,
        action: AuditAction.RiskReviewFailed,
        entityType: AuditEntityType.MerchantApplication,
        entityId: locked.id,
        metadata: { submissionNo: job.submissionNo, reason },
      });
      return true;
    });
  }

  public findStuckSubmissions(olderThan: Date, limit: number): Promise<PendingSubmission[]> {
    return this.applicationsRepository.findStuckSubmissions(olderThan, limit);
  }

  private async callProvider(request: RiskAssessmentRequest): Promise<RiskAssessmentResult> {
    const timeoutMs = this.config.riskReview.providerTimeoutMs;
    try {
      return await this.provider.assess(request, AbortSignal.timeout(timeoutMs));
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw new RiskProviderError(`Risk provider did not respond within ${timeoutMs}ms`, true);
      }
      throw error;
    }
  }

  private isAwaitingSubmission(app: MerchantApplication, job: AssessJobData): boolean {
    return app.status === ApplicationStatus.Submitted && app.submissionCount === job.submissionNo;
  }
}
