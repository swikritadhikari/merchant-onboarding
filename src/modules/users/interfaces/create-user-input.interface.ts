import { type Role } from '../enums';

export interface CreateUserInput {
  email: string;
  fullName: string;
  role: Role;
  password: string;
}
