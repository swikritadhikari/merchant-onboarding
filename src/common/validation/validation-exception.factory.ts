import { type ValidationError } from 'class-validator';
import { ValidationFailedError } from '../errors';
import { flattenValidationErrors } from './flatten-validation-errors';

export function validationExceptionFactory(errors: ValidationError[]): ValidationFailedError {
  return new ValidationFailedError(flattenValidationErrors(errors));
}
