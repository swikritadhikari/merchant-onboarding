import { HttpStatus } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';
import { BODY_METHODS } from '../constants';
import { ErrorCode } from '../enums';
import { writeErrorResponse } from '../filters/error-response.writer';

function hasBody(request: Request): boolean {
  const length = request.header('content-length');
  return (
    request.header('transfer-encoding') !== undefined || (length !== undefined && length !== '0')
  );
}

export function jsonContentTypeMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (BODY_METHODS.has(request.method) && hasBody(request) && !request.is('application/json')) {
    writeErrorResponse(response, request, {
      status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      code: ErrorCode.UnsupportedMediaType,
      message: 'Request body must be application/json',
    });
    return;
  }
  next();
}
