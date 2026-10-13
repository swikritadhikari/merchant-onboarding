import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token returned by /auth/login or /auth/refresh' })
  @IsString()
  @Length(20, 200)
  public refreshToken!: string;
}
