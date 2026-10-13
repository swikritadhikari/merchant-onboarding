import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty() public accessToken!: string;
  @ApiProperty({ example: 'Bearer' }) public tokenType!: 'Bearer';
  @ApiProperty({ description: 'Lifetime of the access token in seconds' })
  public expiresIn!: number;
  @ApiProperty({ description: 'Single-use; every refresh returns a new one' })
  public refreshToken!: string;
  @ApiProperty({ description: 'Lifetime of the refresh token in seconds' })
  public refreshExpiresIn!: number;
}
