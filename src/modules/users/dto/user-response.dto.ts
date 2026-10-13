import { ApiProperty } from '@nestjs/swagger';
import { type User } from '../entities';
import { Role } from '../enums';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' }) public id!: string;
  @ApiProperty() public email!: string;
  @ApiProperty() public fullName!: string;
  @ApiProperty({ enum: Role }) public role!: Role;

  public static from(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.fullName = user.fullName;
    dto.role = user.role;
    return dto;
  }
}
