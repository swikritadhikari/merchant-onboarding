import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class OwnerContactDto {
  @ApiProperty({ example: 'Jane Example' })
  @IsString()
  @Length(2, 120)
  public fullName!: string;

  @ApiProperty({ example: 'owner@example.test' })
  @IsEmail()
  @Length(3, 254)
  public email!: string;

  @ApiProperty({ example: '+15555550100', description: 'E.164 format' })
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be in E.164 format, e.g. +15555550100' })
  public phone!: string;
}
