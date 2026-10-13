import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums';

export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, HttpStatus>> = {
  [ErrorCode.BadRequest]: HttpStatus.BAD_REQUEST,
  [ErrorCode.ValidationFailed]: HttpStatus.BAD_REQUEST,
  [ErrorCode.Unauthorized]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.Forbidden]: HttpStatus.FORBIDDEN,
  [ErrorCode.NotFound]: HttpStatus.NOT_FOUND,
  [ErrorCode.Conflict]: HttpStatus.CONFLICT,
  [ErrorCode.InvalidStateTransition]: HttpStatus.CONFLICT,
  [ErrorCode.PayloadTooLarge]: HttpStatus.PAYLOAD_TOO_LARGE,
  [ErrorCode.UnsupportedMediaType]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  [ErrorCode.BusinessRuleViolation]: HttpStatus.UNPROCESSABLE_ENTITY,
  [ErrorCode.RateLimited]: HttpStatus.TOO_MANY_REQUESTS,
  [ErrorCode.InternalError]: HttpStatus.INTERNAL_SERVER_ERROR,
  [ErrorCode.ServiceUnavailable]: HttpStatus.SERVICE_UNAVAILABLE,
};

export const ERROR_CODE_BY_HTTP_STATUS: ReadonlyMap<number, ErrorCode> = new Map([
  [HttpStatus.BAD_REQUEST, ErrorCode.BadRequest],
  [HttpStatus.UNAUTHORIZED, ErrorCode.Unauthorized],
  [HttpStatus.FORBIDDEN, ErrorCode.Forbidden],
  [HttpStatus.NOT_FOUND, ErrorCode.NotFound],
  [HttpStatus.METHOD_NOT_ALLOWED, ErrorCode.NotFound],
  [HttpStatus.CONFLICT, ErrorCode.Conflict],
  [HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PayloadTooLarge],
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UnsupportedMediaType],
  [HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.BusinessRuleViolation],
  [HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RateLimited],
  [HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.ServiceUnavailable],
]);

export const GENERIC_ERROR_MESSAGES: Readonly<Partial<Record<ErrorCode, string>>> = {
  [ErrorCode.InternalError]: 'An unexpected error occurred',
  [ErrorCode.ServiceUnavailable]: 'The service is temporarily unavailable, please retry',
  [ErrorCode.RateLimited]: 'Too many requests, please retry later',
  [ErrorCode.Unauthorized]: 'Authentication is required',
};

export const TRANSIENT_RETRY_AFTER_SECONDS = 1;
export const SERVER_ERROR_STATUS_MIN: number = HttpStatus.INTERNAL_SERVER_ERROR;
export const SERVICE_UNAVAILABLE_STATUS: number = HttpStatus.SERVICE_UNAVAILABLE;
