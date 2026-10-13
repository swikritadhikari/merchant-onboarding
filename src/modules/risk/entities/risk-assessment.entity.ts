import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { MerchantApplication } from '../../applications/entities';
import { RiskLevel } from '../enums';

@Entity({ name: 'risk_assessments' })
@Unique('uq_risk_assessments_application_submission', ['applicationId', 'submissionNo'])
@Check('chk_risk_assessments_score', `"score" BETWEEN 0 AND 100`)
@Check('chk_risk_assessments_level', `"risk_level" IN ('LOW', 'MEDIUM', 'HIGH')`)
export class RiskAssessment {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ name: 'application_id', type: 'uuid' })
  public applicationId!: string;

  @ManyToOne(() => MerchantApplication, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'application_id',
    foreignKeyConstraintName: 'fk_risk_assessments_application',
  })
  public application?: MerchantApplication;

  @Column({ name: 'submission_no', type: 'integer' })
  public submissionNo!: number;

  @Column({ type: 'varchar', length: 64 })
  public provider!: string;

  @Column({ name: 'provider_reference', type: 'varchar', length: 128 })
  public providerReference!: string;

  @Column({ type: 'smallint' })
  public score!: number;

  @Column({ name: 'risk_level', type: 'varchar', length: 16 })
  public riskLevel!: RiskLevel;

  @Column({ type: 'jsonb' })
  public reasons!: string[];

  @Column({ type: 'smallint' })
  public attempt!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;
}
