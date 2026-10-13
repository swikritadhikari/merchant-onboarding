import { ErrorCode } from '../enums';
import { DomainError } from './domain.error';

export class BusinessRuleViolationError extends DomainError {
  public readonly code = ErrorCode.BusinessRuleViolation;
}
