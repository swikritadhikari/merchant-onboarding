import { ErrorCode } from '../enums';
import { DomainError } from './domain.error';

export class ResourceNotFoundError extends DomainError {
  public readonly code = ErrorCode.NotFound;

  constructor(resource: string) {
    super(`${resource} not found`);
  }
}
