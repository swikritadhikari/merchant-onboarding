import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_RATE_LIMIT_KEY } from '../constants';

const reflector = new Reflector();

export function isAuthRateLimited(context: ExecutionContext): boolean {
  return reflector.get<boolean | undefined>(AUTH_RATE_LIMIT_KEY, context.getHandler()) === true;
}
