import { Param, ParseUUIDPipe } from '@nestjs/common';
import { ValidationFailedError } from '../errors';

export const UuidParam = (name = 'id'): ParameterDecorator =>
  Param(
    name,
    new ParseUUIDPipe({
      exceptionFactory: () =>
        new ValidationFailedError([{ field: name, messages: [`${name} must be a valid UUID`] }]),
    }),
  );
