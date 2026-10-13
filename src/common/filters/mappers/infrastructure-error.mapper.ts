import { NETWORK_ERROR_CODES } from '../../constants';
import { type ResolvedError } from '../../interfaces';
import { hasStringProperty } from '../../utils';
import { serviceUnavailable } from './database-error.mapper';

const CONNECTION_LOST_PATTERNS: readonly RegExp[] = [
  /connection terminated/i,
  /connection timeout/i,
  /timeout exceeded when trying to connect/i,
  /Connection is closed/i,
];

export function mapInfrastructureError(exception: unknown): ResolvedError | null {
  if (hasStringProperty(exception, 'code') && NETWORK_ERROR_CODES.has(exception.code)) {
    return serviceUnavailable();
  }
  if (
    exception instanceof Error &&
    CONNECTION_LOST_PATTERNS.some((pattern) => pattern.test(exception.message))
  ) {
    return serviceUnavailable();
  }
  return null;
}
