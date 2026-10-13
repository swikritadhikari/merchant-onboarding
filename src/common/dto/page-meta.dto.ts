import { ApiProperty } from '@nestjs/swagger';

export class PageMetaDto {
  @ApiProperty() public page!: number;
  @ApiProperty() public limit!: number;
  @ApiProperty() public total!: number;
  @ApiProperty() public totalPages!: number;

  public static of(page: number, limit: number, total: number): PageMetaDto {
    const meta = new PageMetaDto();
    meta.page = page;
    meta.limit = limit;
    meta.total = total;
    meta.totalPages = Math.ceil(total / limit);
    return meta;
  }
}
