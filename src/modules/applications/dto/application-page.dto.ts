import { ApiProperty } from '@nestjs/swagger';
import { PageMetaDto } from '../../../common/dto';
import { ApplicationResponseDto } from './application-response.dto';

export class ApplicationPageDto {
  @ApiProperty({ type: [ApplicationResponseDto] }) public data!: ApplicationResponseDto[];
  @ApiProperty({ type: PageMetaDto }) public meta!: PageMetaDto;
}
