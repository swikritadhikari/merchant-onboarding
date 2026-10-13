import { Column } from 'typeorm';
import { bigintToNumber } from '../../../common/transformers';

export class ProcessingProfile {
  @Column({
    name: 'processing_monthly_volume_minor',
    type: 'bigint',
    transformer: bigintToNumber,
  })
  public monthlyVolumeMinor!: number;

  @Column({
    name: 'processing_average_ticket_minor',
    type: 'bigint',
    transformer: bigintToNumber,
  })
  public averageTicketMinor!: number;

  @Column({ name: 'processing_currency', type: 'char', length: 3 })
  public currency!: string;

  @Column({ name: 'processing_mcc', type: 'char', length: 4 })
  public mcc!: string;
}
