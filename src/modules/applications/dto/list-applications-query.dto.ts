import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto';
import { ApplicationStatus } from '../enums';

const toStatusList = ({ value }: { value: unknown }): string[] =>
  (Array.isArray(value) ? value : [value])
    .flatMap((item: unknown) => String(item).split(','))
    .filter((item) => item.length > 0);

const toBoolean = ({ value }: { value: unknown }): boolean => value === true || value === 'true';

export class ListApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ApplicationStatus,
    isArray: true,
    description:
      'Filter by one or more statuses: ?status=SUBMITTED&status=UNDER_REVIEW or ?status=SUBMITTED,UNDER_REVIEW',
  })
  @IsOptional()
  @Transform(toStatusList)
  @IsEnum(ApplicationStatus, { each: true })
  public status?: ApplicationStatus[];

  @ApiPropertyOptional({ description: 'Only applications assigned to the calling reviewer' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  public assignedToMe?: boolean;
}
