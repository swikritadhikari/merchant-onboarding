import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ReviewDecision } from '../enums';

export class ReviewDecisionDto {
  @ApiProperty({ enum: ReviewDecision })
  @IsEnum(ReviewDecision)
  public decision!: ReviewDecision;

  @ApiPropertyOptional({
    description: 'Required for REJECT and REQUEST_INFO, and for APPROVE when risk is HIGH',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  public note?: string;
}
