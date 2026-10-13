import { Logger } from '@nestjs/common';
import { type ErrorRequestHandler, type NextFunction, type Request, type Response } from 'express';
import {
  debugInfoFor,
  logResolvedError,
  writeErrorResponse,
} from '../filters/error-response.writer';
import { resolveError } from '../filters/mappers';

export function createHttpErrorMiddleware(exposeDetails: boolean): ErrorRequestHandler {
  const logger = new Logger('HttpErrorMiddleware');
  return (error: unknown, request: Request, response: Response, _next: NextFunction): void => {
    const resolved = resolveError(error);
    logResolvedError(logger, resolved, error, request);
    writeErrorResponse(response, request, resolved, debugInfoFor(error, resolved, exposeDetails));
  };
}
