import { type ValidationError } from 'class-validator';
import { flattenValidationErrors } from './flatten-validation-errors';

const error = (
  property: string,
  constraints?: Record<string, string>,
  children: ValidationError[] = [],
): ValidationError => ({ property, constraints, children });

describe('flattenValidationErrors', () => {
  it('produces dotted field paths for nested objects and arrays', () => {
    const result = flattenValidationErrors([
      error('businessName', { isLength: 'businessName too short' }),
      error('owner', undefined, [
        error('email', { isEmail: 'owner.email must be an email' }),
        error('phone', { matches: 'phone must be E.164' }),
      ]),
      error('items', undefined, [
        error('0', undefined, [error('sku', { isString: 'sku must be a string' })]),
      ]),
    ]);

    expect(result).toEqual([
      { field: 'businessName', messages: ['businessName too short'] },
      { field: 'owner.email', messages: ['owner.email must be an email'] },
      { field: 'owner.phone', messages: ['phone must be E.164'] },
      { field: 'items.0.sku', messages: ['sku must be a string'] },
    ]);
  });

  it('returns an empty list when there is nothing to report', () => {
    expect(flattenValidationErrors([])).toEqual([]);
  });
});
