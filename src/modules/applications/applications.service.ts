import { Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { type AuditLog } from '../audit/entities';
import { AuditAction, AuditEntityType } from '../audit/enums';
import { type AuthenticatedUser } from '../auth/interfaces';
import { PageMetaDto } from '../../common/dto';
import {
  BusinessRuleViolationError,
  InvalidStateTransitionError,
  ResourceNotFoundError,
} from '../../common/errors';
import { TransactionService } from '../../database';
import { RiskReviewProducer } from '../risk/producers';
import { Role } from '../users/enums';
import { UsersService } from '../users/users.service';
import { ApplicationsRepository } from './applications.repository';
import {
  actionForDecision,
  ApplicationAccessPolicy,
  assertDecisionIsJustified,
  assertProcessingIsConsistent,
  isEditable,
  isTerminal,
  transition,
} from './domain';
import {
  type CreateApplicationDto,
  type ListApplicationsQueryDto,
  type ReviewDecisionDto,
  type UpdateApplicationDto,
} from './dto';
import { type MerchantApplication } from './entities';
import { ApplicationAction, ApplicationOperation, ApplicationStatus, RiskStatus } from './enums';
import { type ApplicationPage } from './interfaces';
import { applyApplicationUpdate, toOwnerContact, toProcessingProfile } from './mappers';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly transactions: TransactionService,
    private readonly auditService: AuditService,
    private readonly usersService: UsersService,
    private readonly riskReviewProducer: RiskReviewProducer,
  ) {}

  public create(dto: CreateApplicationDto, actor: AuthenticatedUser): Promise<MerchantApplication> {
    assertProcessingIsConsistent(dto.processing);

    return this.transactions.run(async () => {
      const application = await this.applicationsRepository.create({
        businessName: dto.businessName,
        legalBusinessName: dto.legalBusinessName,
        businessType: dto.businessType,
        taxId: dto.taxId,
        bankAccountNumber: dto.bankAccountNumber,
        owner: toOwnerContact(dto.owner),
        processing: toProcessingProfile(dto.processing),
        status: ApplicationStatus.Draft,
        riskStatus: RiskStatus.NotStarted,
        createdById: actor.id,
      });
      await this.audit(actor, AuditAction.ApplicationCreated, application.id, {
        businessName: application.businessName,
      });
      return application;
    });
  }

  public async findOne(id: string, actor: AuthenticatedUser): Promise<MerchantApplication> {
    const application = await this.applicationsRepository.findById(id);
    if (!application) {
      throw new ResourceNotFoundError('Application');
    }
    ApplicationAccessPolicy.assertCanView(actor, application);
    return application;
  }

  public async list(
    query: ListApplicationsQueryDto,
    actor: AuthenticatedUser,
  ): Promise<ApplicationPage> {
    const page = await this.applicationsRepository.findPage({
      ...(actor.role === Role.Sales ? { createdById: actor.id } : {}),
      ...(query.assignedToMe === true ? { assignedReviewerId: actor.id } : {}),
      ...(query.status ? { statuses: query.status } : {}),
      offset: query.offset,
      limit: query.limit,
    });
    return { data: page.items, meta: PageMetaDto.of(query.page, query.limit, page.total) };
  }

  public update(
    id: string,
    dto: UpdateApplicationDto,
    actor: AuthenticatedUser,
  ): Promise<MerchantApplication> {
    return this.transactions.run(async () => {
      const application = await this.lockForActor(id, actor);
      ApplicationAccessPolicy.assertCanModify(actor, application);

      if (!isEditable(application.status)) {
        throw new InvalidStateTransitionError(application.status, ApplicationOperation.Edit);
      }

      const changedFields = applyApplicationUpdate(application, dto);
      if (changedFields.length === 0) {
        return application;
      }

      assertProcessingIsConsistent(application.processing);
      const saved = await this.applicationsRepository.save(application);

      await this.audit(actor, AuditAction.ApplicationUpdated, id, { changedFields });
      return saved;
    });
  }

  public async submit(id: string, actor: AuthenticatedUser): Promise<MerchantApplication> {
    const submitted = await this.transactions.run(async () => {
      const application = await this.lockForActor(id, actor);
      ApplicationAccessPolicy.assertCanModify(actor, application);

      const from = application.status;
      application.status = transition(from, ApplicationAction.Submit);
      application.submissionCount += 1;
      application.submittedAt = new Date();
      application.riskStatus = RiskStatus.Pending;
      application.riskScore = null;
      application.riskAssessedAt = null;
      application.decision = null;
      application.decisionNote = null;
      application.decidedById = null;
      application.decidedAt = null;
      const saved = await this.applicationsRepository.save(application);

      await this.audit(actor, AuditAction.ApplicationSubmitted, id, {
        from,
        submissionNo: saved.submissionCount,
      });
      return saved;
    });

    await this.enqueueRiskReview(submitted);
    return submitted;
  }

  public assignReviewer(
    id: string,
    reviewerId: string,
    actor: AuthenticatedUser,
  ): Promise<MerchantApplication> {
    return this.transactions.run(async () => {
      const application = await this.lockForActor(id, actor);

      if (isTerminal(application.status)) {
        throw new InvalidStateTransitionError(
          application.status,
          ApplicationOperation.AssignReviewer,
        );
      }

      const reviewer = await this.usersService.findActiveByIdAndRole(reviewerId, Role.Reviewer);
      if (!reviewer) {
        throw new BusinessRuleViolationError('Assignee must be an active REVIEWER');
      }

      const previousReviewerId = application.assignedReviewerId;
      application.assignedReviewerId = reviewer.id;
      const saved = await this.applicationsRepository.save(application);

      await this.audit(actor, AuditAction.ReviewerAssigned, id, {
        previousReviewerId,
        reviewerId: reviewer.id,
      });
      return saved;
    });
  }

  public recordDecision(
    id: string,
    dto: ReviewDecisionDto,
    actor: AuthenticatedUser,
  ): Promise<MerchantApplication> {
    return this.transactions.run(async () => {
      const application = await this.lockForActor(id, actor);
      ApplicationAccessPolicy.assertCanDecide(actor, application);

      const from = application.status;
      const to = transition(from, actionForDecision(dto.decision));
      assertDecisionIsJustified(dto.decision, application.riskStatus, dto.note);

      const note = dto.note?.trim();
      application.status = to;
      application.decision = dto.decision;
      application.decisionNote = note !== undefined && note.length > 0 ? note : null;
      application.decidedById = actor.id;
      application.decidedAt = new Date();
      const saved = await this.applicationsRepository.save(application);

      await this.audit(actor, AuditAction.ReviewDecisionRecorded, id, {
        decision: dto.decision,
        from,
        to,
        riskStatus: application.riskStatus,
        submissionNo: application.submissionCount,
      });
      return saved;
    });
  }

  public async auditTrail(id: string, actor: AuthenticatedUser): Promise<AuditLog[]> {
    await this.findOne(id, actor);
    return this.auditService.findForEntity(AuditEntityType.MerchantApplication, id);
  }

  private async lockForActor(id: string, actor: AuthenticatedUser): Promise<MerchantApplication> {
    const application = await this.applicationsRepository.findByIdForUpdate(id);
    if (!application) {
      throw new ResourceNotFoundError('Application');
    }
    ApplicationAccessPolicy.assertCanView(actor, application);
    return application;
  }

  private async enqueueRiskReview(application: MerchantApplication): Promise<void> {
    try {
      await this.riskReviewProducer.enqueueAssessment({
        applicationId: application.id,
        submissionNo: application.submissionCount,
      });
    } catch (error: unknown) {
      this.logger.error(
        `Failed to enqueue risk review for ${application.id}; reconciler will retry`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private audit(
    actor: AuthenticatedUser,
    action: AuditAction,
    entityId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    return this.auditService.record({
      actor,
      action,
      entityType: AuditEntityType.MerchantApplication,
      entityId,
      metadata,
    });
  }
}
