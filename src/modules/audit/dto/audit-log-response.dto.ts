import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../users/enums';
import { type AuditLog } from '../entities';
import { AuditAction } from '../enums';

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty({ enum: AuditAction }) public action!: AuditAction;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) public actorId!: string | null;
  @ApiProperty({ enum: Role, nullable: true }) public actorRole!: Role | null;
  @ApiProperty({ type: 'object', additionalProperties: true })
  public metadata!: Record<string, unknown>;
  @ApiProperty() public createdAt!: Date;

  public static from(log: AuditLog): AuditLogResponseDto {
    const dto = new AuditLogResponseDto();
    dto.id = log.id;
    dto.action = log.action;
    dto.actorId = log.actorId;
    dto.actorRole = log.actorRole;
    dto.metadata = log.metadata;
    dto.createdAt = log.createdAt;
    return dto;
  }
}
