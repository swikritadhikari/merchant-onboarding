import { type LoggerService } from '@nestjs/common';
import { type Request, type Response } from 'express';
import {
  REQUEST_ID_HEADER,
  SERVER_ERROR_STATUS_MIN,
  SERVICE_UNAVAILABLE_STATUS,
} from '../constants';
import { type ErrorDebugInfo, type ErrorResponse, type ResolvedError } from '../interfaces';
import { describeError, getRequestUser } from '../utils';

export function buildErrorResponse(
  resolved: ResolvedError,
  request: Request,
  debug?: ErrorDebugInfo,
): ErrorResponse {
  return {
    statusCode: resolved.status,
    code: resolved.code,
    message: resolved.message,
    ...(resolved.details ? { details: resolved.details } : {}),
    path: request.path,
    method: request.method,
    requestId: request.header(REQUEST_ID_HEADER),
    timestamp: new Date().toISOString(),
    ...(debug ? { debug } : {}),
  };
}

export function debugInfoFor(
  exception: unknown,
  resolved: ResolvedError,
  exposeDetails: boolean,
): ErrorDebugInfo | undefined {
  if (!exposeDetails || resolved.status < SERVER_ERROR_STATUS_MIN) {
    return undefined;
  }
  return exception instanceof Error
    ? { name: exception.name, message: exception.message }
    : { name: typeof exception, message: describeError(exception) };
}

export function logResolvedError(
  logger: LoggerService,
  resolved: ResolvedError,
  exception: unknown,
  request: Request,
): void {
  const userId = getRequestUser(request)?.id;
  const context =
    `${request.method} ${request.path} -> ${resolved.status} ${resolved.code}` +
    ` requestId=${request.header(REQUEST_ID_HEADER) ?? 'none'}` +
    (userId !== undefined ? ` userId=${userId}` : '');

  if (resolved.status === SERVICE_UNAVAILABLE_STATUS) {
    logger.warn(`${context}: ${describeError(exception)}`);
  } else if (resolved.status >= SERVER_ERROR_STATUS_MIN) {
    logger.error(context, exception instanceof Error ? exception.stack : describeError(exception));
  } else if (logger.debug) {
    logger.debug(`${context}: ${resolved.message}`);
  }
}

export function writeErrorResponse(
  response: Response,
  request: Request,
  resolved: ResolvedError,
  debug?: ErrorDebugInfo,
): void {
  if (response.headersSent) {
    response.end();
    return;
  }
  if (resolved.retryAfterSeconds !== undefined) {
    response.setHeader('Retry-After', String(resolved.retryAfterSeconds));
  }
  response.status(resolved.status).json(buildErrorResponse(resolved, request, debug));
}
