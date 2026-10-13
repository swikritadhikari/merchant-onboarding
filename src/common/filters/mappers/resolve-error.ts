import { HttpStatus } from '@nestjs/common';
import { GENERIC_ERROR_MESSAGES } from '../../constants';
import { ErrorCode } from '../../enums';
import { type ResolvedError } from '../../interfaces';
import { mapBodyParserError } from './body-parser-error.mapper';
import { mapDatabaseError } from './database-error.mapper';
import { mapDomainError } from './domain-error.mapper';
import { mapHttpException } from './http-exception.mapper';
import { mapInfrastructureError } from './infrastructure-error.mapper';

type ErrorMapper = (exception: unknown) => ResolvedError | null;

const MAPPERS: readonly ErrorMapper[] = [
  mapDomainError,
  mapHttpException,
  mapBodyParserError,
  mapDatabaseError,
  mapInfrastructureError,
];

export const INTERNAL_ERROR: ResolvedError = {
  status: HttpStatus.INTERNAL_SERVER_ERROR,
  code: ErrorCode.InternalError,
  message: GENERIC_ERROR_MESSAGES[ErrorCode.InternalError] ?? 'Internal error',
};

export function resolveError(exception: unknown): ResolvedError {
  for (const mapper of MAPPERS) {
    const resolved = mapper(exception);
    if (resolved !== null) {
      return resolved;
    }
  }
  return INTERNAL_ERROR;
}
