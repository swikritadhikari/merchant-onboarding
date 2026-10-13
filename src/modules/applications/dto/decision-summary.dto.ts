import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewDecision } from '../enums';

export class DecisionSummaryDto {
  @ApiProperty({ enum: ReviewDecision }) public decision!: ReviewDecision;
  @ApiPropertyOptional({ type: String, nullable: true }) public note!: string | null;
  @ApiProperty({ format: 'uuid' }) public decidedById!: string;
  @ApiProperty() public decidedAt!: Date;
}
