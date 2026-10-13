import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { BusinessType } from '../enums';
import { OwnerContactDto } from './owner-contact.dto';
import { ProcessingProfileDto } from './processing-profile.dto';

export class CreateApplicationDto {
  @ApiProperty({ example: 'Corner Coffee' })
  @IsString()
  @Length(2, 200)
  public businessName!: string;

  @ApiProperty({ example: 'Corner Coffee Holdings LLC' })
  @IsString()
  @Length(2, 200)
  public legalBusinessName!: string;

  @ApiProperty({ enum: BusinessType })
  @IsEnum(BusinessType)
  public businessType!: BusinessType;

  @ApiProperty({ example: '00-0000000', description: 'Business tax identifier. Returned masked.' })
  @Matches(/^[A-Za-z0-9-]{6,32}$/, { message: 'taxId must be 6-32 letters, digits or dashes' })
  public taxId!: string;

  @ApiProperty({ example: '000123456789', description: 'Settlement account. Returned masked.' })
  @Matches(/^[A-Za-z0-9]{6,34}$/, { message: 'bankAccountNumber must be 6-34 letters or digits' })
  public bankAccountNumber!: string;

  @ApiProperty({ type: OwnerContactDto })
  @ValidateNested()
  @Type(() => OwnerContactDto)
  public owner!: OwnerContactDto;

  @ApiProperty({ type: ProcessingProfileDto })
  @ValidateNested()
  @Type(() => ProcessingProfileDto)
  public processing!: ProcessingProfileDto;
}
