import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Role } from '../enums';

@Entity({ name: 'users' })
@Check('chk_users_email_lowercase', `"email" = lower("email")`)
export class User {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 254 })
  public email!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  public fullName!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 100, select: false })
  public passwordHash!: string;

  @Column({ type: 'enum', enum: Role, enumName: 'user_role' })
  public role!: Role;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  public isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  public createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  public updatedAt!: Date;
}
