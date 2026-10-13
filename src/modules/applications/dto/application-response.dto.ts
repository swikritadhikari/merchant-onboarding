import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { maskValue } from '../../../common/security';
import { type MerchantApplication } from '../entities';
import { toOwnerContactDto, toProcessingProfileDto } from '../mappers';
import { ApplicationStatus, BusinessType } from '../enums';
import { DecisionSummaryDto } from './decision-summary.dto';
import { OwnerContactDto } from './owner-contact.dto';
import { ProcessingProfileDto } from './processing-profile.dto';
import { RiskSummaryDto } from './risk-summary.dto';

export class ApplicationResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public businessName!: string;
  @ApiProperty() public legalBusinessName!: string;
  @ApiProperty({ enum: BusinessType }) public businessType!: BusinessType;
  @ApiProperty({ example: '******0000', description: 'Masked' }) public taxId!: string;
  @ApiProperty({ example: '********6789', description: 'Masked' })
  public bankAccountNumber!: string;
  @ApiProperty({ type: OwnerContactDto }) public owner!: OwnerContactDto;
  @ApiProperty({ type: ProcessingProfileDto }) public processing!: ProcessingProfileDto;
  @ApiProperty({ enum: ApplicationStatus }) public status!: ApplicationStatus;
  @ApiProperty({ type: RiskSummaryDto }) public risk!: RiskSummaryDto;
  @ApiProperty() public submissionCount!: number;
  @ApiPropertyOptional({ type: Date, nullable: true }) public submittedAt!: Date | null;
  @ApiProperty({ format: 'uuid' }) public createdById!: string;
  @ApiPropertyOptional({ format: 'uuid', type: String, nullable: true })
  public assignedReviewerId!: string | null;
  @ApiPropertyOptional({ type: DecisionSummaryDto, nullable: true })
  public decision!: DecisionSummaryDto | null;
  @ApiProperty() public version!: number;
  @ApiProperty() public createdAt!: Date;
  @ApiProperty() public updatedAt!: Date;

  public static from(app: MerchantApplication): ApplicationResponseDto {
    const dto = new ApplicationResponseDto();
    dto.id = app.id;
    dto.businessName = app.businessName;
    dto.legalBusinessName = app.legalBusinessName;
    dto.businessType = app.businessType;
    dto.taxId = maskValue(app.taxId);
    dto.bankAccountNumber = maskValue(app.bankAccountNumber);
    dto.owner = toOwnerContactDto(app.owner);
    dto.processing = toProcessingProfileDto(app.processing);
    dto.status = app.status;
    dto.risk = { status: app.riskStatus, score: app.riskScore, assessedAt: app.riskAssessedAt };
    dto.submissionCount = app.submissionCount;
    dto.submittedAt = app.submittedAt;
    dto.createdById = app.createdById;
    dto.assignedReviewerId = app.assignedReviewerId;
    dto.decision = ApplicationResponseDto.decisionOf(app);
    dto.version = app.version;
    dto.createdAt = app.createdAt;
    dto.updatedAt = app.updatedAt;
    return dto;
  }

  private static decisionOf(app: MerchantApplication): DecisionSummaryDto | null {
    if (app.decision === null || app.decidedById === null || app.decidedAt === null) {
      return null;
    }
    return {
      decision: app.decision,
      note: app.decisionNote,
      decidedById: app.decidedById,
      decidedAt: app.decidedAt,
    };
  }
}
