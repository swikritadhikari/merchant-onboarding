import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../enums';

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  public role?: Role;

  @ApiPropertyOptional({
    description: 'false deactivates the user; their tokens stop working at once',
  })
  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}
