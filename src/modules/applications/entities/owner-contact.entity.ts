import { Column } from 'typeorm';

export class OwnerContact {
  @Column({ name: 'owner_full_name', type: 'varchar', length: 120 })
  public fullName!: string;

  @Column({ name: 'owner_email', type: 'varchar', length: 254 })
  public email!: string;

  @Column({ name: 'owner_phone', type: 'varchar', length: 20 })
  public phone!: string;
}
