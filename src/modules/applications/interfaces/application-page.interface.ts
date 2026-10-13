import { type PageMetaDto } from '../../../common/dto';
import { type MerchantApplication } from '../entities';

export interface ApplicationPage {
  data: MerchantApplication[];
  meta: PageMetaDto;
}
