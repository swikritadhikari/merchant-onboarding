import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { type Request } from 'express';
import { type AuthenticatedUser } from '../../modules/auth/interfaces';
import { getRequestUser } from '../utils';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const user = getRequestUser(ctx.switchToHttp().getRequest<Request>());
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  },
);
