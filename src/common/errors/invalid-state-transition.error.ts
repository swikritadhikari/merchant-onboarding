import { ErrorCode } from '../enums';
import { DomainError } from './domain.error';

export class InvalidStateTransitionError extends DomainError {
  public readonly code = ErrorCode.InvalidStateTransition;

  constructor(
    public readonly from: string,
    public readonly action: string,
  ) {
    super(`Cannot ${action} an application in status ${from}`);
  }
}
