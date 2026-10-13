import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import { AUTH_RATE_LIMIT_KEY } from '../throttling/constants';

export const AuthRateLimit = (): CustomDecorator => SetMetadata(AUTH_RATE_LIMIT_KEY, true);
