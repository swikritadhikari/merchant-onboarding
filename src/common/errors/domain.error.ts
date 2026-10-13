import { type ErrorCode } from '../enums';
import { type ErrorDetail } from '../interfaces';

export abstract class DomainError extends Error {
  public abstract readonly code: ErrorCode;
  public readonly details: ErrorDetail[] | undefined;

  constructor(message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}
