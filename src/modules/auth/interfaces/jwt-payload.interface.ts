import { type Role } from '../../users/enums';

export interface JwtPayload {
  sub: string;
  role: Role;
  sid: string;
  jti: string;
}
