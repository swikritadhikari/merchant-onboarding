import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { User } from '../../users/entities';
import { ApplicationStatus, BusinessType, ReviewDecision, RiskStatus } from '../enums';
import { OwnerContact } from './owner-contact.entity';
import { ProcessingProfile } from './processing-profile.entity';

@Entity({ name: 'merchant_applications' })
@Index('idx_merchant_applications_status_created_at', ['status', 'createdAt'])
@Index('idx_merchant_applications_created_by', ['createdById', 'createdAt'])
@Index('idx_merchant_applications_reviewer', ['assignedReviewerId', 'createdAt'])
@Index('idx_merchant_applications_created_at', ['createdAt', 'id'])
@Index('idx_merchant_applications_decided_by', ['decidedById'])
@Index('idx_merchant_applications_pending_submission', ['submittedAt'], {
  where: `"status" = 'SUBMITTED'`,
})
@Check(
  'chk_merchant_applications_risk_score',
  `"risk_score" IS NULL OR "risk_score" BETWEEN 0 AND 100`,
)
@Check('chk_merchant_applications_submission_count', `"submission_count" >= 0`)
@Check(
  'chk_merchant_applications_amounts',
  `"processing_monthly_volume_minor" >= 0 AND "processing_average_ticket_minor" > 0`,
)
@Check(
  'chk_merchant_applications_decision_fields',
  `("decision" IS NULL) = ("decided_by_id" IS NULL) AND ("decision" IS NULL) = ("decided_at" IS NULL)`,
)
export class MerchantApplication {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ name: 'business_name', type: 'varchar', length: 200 })
  public businessName!: string;

  @Column({ name: 'legal_business_name', type: 'varchar', length: 200 })
  public legalBusinessName!: string;

  @Column({ name: 'business_type', type: 'enum', enum: BusinessType, enumName: 'business_type' })
  public businessType!: BusinessType;

  @Column({ name: 'tax_id', type: 'varchar', length: 32 })
  public taxId!: string;

  @Column({ name: 'bank_account_number', type: 'varchar', length: 34 })
  public bankAccountNumber!: string;

  @Column(() => OwnerContact, { prefix: false })
  public owner!: OwnerContact;

  @Column(() => ProcessingProfile, { prefix: false })
  public processing!: ProcessingProfile;

  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    enumName: 'application_status',
    default: ApplicationStatus.Draft,
  })
  public status!: ApplicationStatus;

  @Column({
    name: 'risk_status',
    type: 'enum',
    enum: RiskStatus,
    enumName: 'risk_status',
    default: RiskStatus.NotStarted,
  })
  public riskStatus!: RiskStatus;

  @Column({ name: 'risk_score', type: 'smallint', nullable: true })
  public riskScore!: number | null;

  @Column({ name: 'risk_assessed_at', type: 'timestamptz', nullable: true })
  public riskAssessedAt!: Date | null;

  @Column({ name: 'submission_count', type: 'integer', default: 0 })
  public submissionCount!: number;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  public submittedAt!: Date | null;

  @Column({ name: 'created_by_id', type: 'uuid' })
  public createdById!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'created_by_id',
    foreignKeyConstraintName: 'fk_merchant_applications_created_by',
  })
  public createdBy?: User;

  @Column({ name: 'assigned_reviewer_id', type: 'uuid', nullable: true })
  public assignedReviewerId!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'assigned_reviewer_id',
    foreignKeyConstraintName: 'fk_merchant_applications_assigned_reviewer',
  })
  public assignedReviewer?: User | null;

  @Column({
    name: 'decision',
    type: 'enum',
    enum: ReviewDecision,
    enumName: 'review_decision',
    nullable: true,
  })
  public decision!: ReviewDecision | null;

  @Column({ name: 'decision_note', type: 'text', nullable: true })
  public decisionNote!: string | null;

  @Column({ name: 'decided_by_id', type: 'uuid', nullable: true })
  public decidedById!: string | null;

  @ManyToOne(() => User, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'decided_by_id',
    foreignKeyConstraintName: 'fk_merchant_applications_decided_by',
  })
  public decidedBy?: User | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  public decidedAt!: Date | null;

  @VersionColumn()
  public version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public updatedAt!: Date;
}
