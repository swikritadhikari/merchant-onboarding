import { type ValidationError } from 'class-validator';
import { type ErrorDetail } from '../interfaces';

export function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): ErrorDetail[] {
  return errors.flatMap((error) => {
    const field = parentPath === '' ? error.property : `${parentPath}.${error.property}`;
    const own: ErrorDetail[] = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    const nested = error.children ? flattenValidationErrors(error.children, field) : [];
    return [...own, ...nested];
  });
}
