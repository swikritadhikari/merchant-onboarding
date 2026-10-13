import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiskStatus } from '../enums';

export class RiskSummaryDto {
  @ApiProperty({ enum: RiskStatus }) public status!: RiskStatus;
  @ApiPropertyOptional({ type: Number, nullable: true }) public score!: number | null;
  @ApiPropertyOptional({ type: Date, nullable: true }) public assessedAt!: Date | null;
}
