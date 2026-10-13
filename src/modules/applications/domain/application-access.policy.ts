import { type AuthenticatedUser } from '../../auth/interfaces';
import { AccessDeniedError, ResourceNotFoundError } from '../../../common/errors';
import { Role } from '../../users/enums';
import { type ApplicationOwnership } from '../interfaces';

export function canView(user: AuthenticatedUser, app: ApplicationOwnership): boolean {
  switch (user.role) {
    case Role.Admin:
    case Role.Reviewer:
      return true;
    case Role.Sales:
      return app.createdById === user.id;
  }
}

export function canModify(user: AuthenticatedUser, app: ApplicationOwnership): boolean {
  return user.role === Role.Admin || (user.role === Role.Sales && app.createdById === user.id);
}

export function canDecide(user: AuthenticatedUser, app: ApplicationOwnership): boolean {
  return user.role === Role.Reviewer && app.assignedReviewerId === user.id;
}

export function assertCanView(user: AuthenticatedUser, app: ApplicationOwnership): void {
  if (!canView(user, app)) {
    throw new ResourceNotFoundError('Application');
  }
}

export function assertCanModify(user: AuthenticatedUser, app: ApplicationOwnership): void {
  assertCanView(user, app);
  if (!canModify(user, app)) {
    throw new AccessDeniedError('You are not allowed to modify this application');
  }
}

export function assertCanDecide(user: AuthenticatedUser, app: ApplicationOwnership): void {
  assertCanView(user, app);
  if (!canDecide(user, app)) {
    throw new AccessDeniedError('Only the assigned reviewer can record a decision');
  }
}
