import { ErrorCode } from '../enums';
import { type ErrorDetail } from '../interfaces';
import { DomainError } from './domain.error';

export class ValidationFailedError extends DomainError {
  public readonly code = ErrorCode.ValidationFailed;

  constructor(details: ErrorDetail[]) {
    super('Request validation failed', details);
  }
}
