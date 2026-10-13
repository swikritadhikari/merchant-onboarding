import { type Request } from 'express';
import { type AuthenticatedUser } from '../../modules/auth/interfaces';

export function getRequestUser(request: Request): AuthenticatedUser | undefined {
  return request.user as AuthenticatedUser | undefined;
}
