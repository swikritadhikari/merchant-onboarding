import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DependencyStatus, HealthStatus } from '../enums';

export class HealthChecksDto {
  @ApiProperty({ enum: DependencyStatus }) public database!: DependencyStatus;
  @ApiProperty({ enum: DependencyStatus }) public redis!: DependencyStatus;
  @ApiProperty() public shuttingDown!: boolean;
}

export class HealthResponseDto {
  @ApiProperty({ enum: HealthStatus }) public status!: HealthStatus;
  @ApiPropertyOptional({ type: HealthChecksDto }) public checks?: HealthChecksDto;
}
