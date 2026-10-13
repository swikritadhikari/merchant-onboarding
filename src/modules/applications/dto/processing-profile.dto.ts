import { ApiProperty } from '@nestjs/swagger';
import { IsISO4217CurrencyCode, IsInt, Matches, Max, Min } from 'class-validator';

export const MAX_MINOR_AMOUNT = 1_000_000_000_000;

export class ProcessingProfileDto {
  @ApiProperty({ example: 2_500_000, description: 'Expected monthly volume in minor units' })
  @IsInt()
  @Min(0)
  @Max(MAX_MINOR_AMOUNT)
  public monthlyVolumeMinor!: number;

  @ApiProperty({ example: 4_500, description: 'Average transaction amount in minor units' })
  @IsInt()
  @Min(1)
  @Max(MAX_MINOR_AMOUNT)
  public averageTicketMinor!: number;

  @ApiProperty({ example: 'USD' })
  @IsISO4217CurrencyCode()
  public currency!: string;

  @ApiProperty({ example: '5812', description: 'ISO 18245 merchant category code' })
  @Matches(/^\d{4}$/, { message: 'mcc must be a 4-digit merchant category code' })
  public mcc!: string;
}
