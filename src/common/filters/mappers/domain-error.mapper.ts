import { ERROR_HTTP_STATUS } from '../../constants';
import { DomainError } from '../../errors';
import { type ResolvedError } from '../../interfaces';

export function mapDomainError(exception: unknown): ResolvedError | null {
  if (!(exception instanceof DomainError)) {
    return null;
  }
  return {
    status: ERROR_HTTP_STATUS[exception.code],
    code: exception.code,
    message: exception.message,
    ...(exception.details ? { details: exception.details } : {}),
  };
}
