import { ErrorCode } from '../enums';
import { DomainError } from './domain.error';

export class AccessDeniedError extends DomainError {
  public readonly code = ErrorCode.Forbidden;
}
