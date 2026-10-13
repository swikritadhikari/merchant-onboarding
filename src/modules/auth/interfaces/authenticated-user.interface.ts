import { type Role } from '../../users/enums';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}
