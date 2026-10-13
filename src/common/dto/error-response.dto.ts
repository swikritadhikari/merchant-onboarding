import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from '../enums';

export class ErrorDetailDto {
  @ApiProperty({ example: 'owner.email' }) public field!: string;
  @ApiProperty({ type: [String], example: ['owner.email must be an email'] })
  public messages!: string[];
}

export class ErrorResponseDto {
  @ApiProperty({ example: 400 }) public statusCode!: number;
  @ApiProperty({ enum: ErrorCode, example: ErrorCode.ValidationFailed }) public code!: ErrorCode;
  @ApiProperty({ example: 'Request validation failed' }) public message!: string;
  @ApiPropertyOptional({ type: [ErrorDetailDto] }) public details?: ErrorDetailDto[];
  @ApiProperty({ example: '/applications' }) public path!: string;
  @ApiProperty({ example: 'POST' }) public method!: string;
  @ApiProperty({ example: '6f1c2b8e-1d2a-4f7b-9a51-0d6c1e2f3a4b' }) public requestId!: string;
  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' }) public timestamp!: string;
}
