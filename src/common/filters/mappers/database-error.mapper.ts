import { HttpStatus } from '@nestjs/common';
import { EntityNotFoundError, OptimisticLockVersionMismatchError, QueryFailedError } from 'typeorm';
import {
  CONSTRAINT_MESSAGES,
  GENERIC_ERROR_MESSAGES,
  PG_CONNECTION_EXCEPTION_CLASS,
  PG_ERROR,
  TRANSIENT_RETRY_AFTER_SECONDS,
} from '../../constants';
import { ErrorCode } from '../../enums';
import { type ResolvedError } from '../../interfaces';
import { hasStringProperty } from '../../utils';

const TRANSIENT_CODES: ReadonlySet<string> = new Set([
  PG_ERROR.SerializationFailure,
  PG_ERROR.DeadlockDetected,
  PG_ERROR.LockNotAvailable,
  PG_ERROR.QueryCanceled,
  PG_ERROR.AdminShutdown,
  PG_ERROR.CrashShutdown,
  PG_ERROR.CannotConnectNow,
  PG_ERROR.TooManyConnections,
]);

const INVALID_INPUT_CODES: ReadonlySet<string> = new Set([
  PG_ERROR.InvalidTextRepresentation,
  PG_ERROR.NumericValueOutOfRange,
  PG_ERROR.StringDataRightTruncation,
  PG_ERROR.InvalidDatetimeFormat,
]);

export function serviceUnavailable(): ResolvedError {
  return {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: ErrorCode.ServiceUnavailable,
    message: GENERIC_ERROR_MESSAGES[ErrorCode.ServiceUnavailable] ?? 'Service unavailable',
    retryAfterSeconds: TRANSIENT_RETRY_AFTER_SECONDS,
  };
}

function constraintOf(driverError: unknown): string | undefined {
  return hasStringProperty(driverError, 'constraint') ? driverError.constraint : undefined;
}

function mapPostgresCode(code: string, driverError: unknown): ResolvedError | null {
  if (code === PG_ERROR.UniqueViolation) {
    const constraint = constraintOf(driverError);
    return {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.Conflict,
      message:
        (constraint !== undefined ? CONSTRAINT_MESSAGES[constraint] : undefined) ??
        'Resource already exists',
    };
  }
  if (code === PG_ERROR.ForeignKeyViolation) {
    return {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.Conflict,
      message: 'The operation conflicts with related records',
    };
  }
  if (code === PG_ERROR.CheckViolation) {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      code: ErrorCode.BusinessRuleViolation,
      message: 'The request violates a data integrity rule',
    };
  }
  if (INVALID_INPUT_CODES.has(code)) {
    return {
      status: HttpStatus.BAD_REQUEST,
      code: ErrorCode.BadRequest,
      message: 'The request contains a value the database cannot accept',
    };
  }
  if (TRANSIENT_CODES.has(code) || code.startsWith(PG_CONNECTION_EXCEPTION_CLASS)) {
    return serviceUnavailable();
  }
  return null;
}

export function mapDatabaseError(exception: unknown): ResolvedError | null {
  if (exception instanceof EntityNotFoundError) {
    return {
      status: HttpStatus.NOT_FOUND,
      code: ErrorCode.NotFound,
      message: 'Resource not found',
    };
  }
  if (exception instanceof OptimisticLockVersionMismatchError) {
    return {
      status: HttpStatus.CONFLICT,
      code: ErrorCode.Conflict,
      message: 'The resource was modified concurrently, reload and retry',
    };
  }
  if (exception instanceof QueryFailedError) {
    const driverError: unknown = exception.driverError;
    if (hasStringProperty(driverError, 'code')) {
      return mapPostgresCode(driverError.code, driverError);
    }
  }
  return null;
}
