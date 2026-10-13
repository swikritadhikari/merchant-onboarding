import { HttpException } from '@nestjs/common';
import {
  ERROR_CODE_BY_HTTP_STATUS,
  GENERIC_ERROR_MESSAGES,
  SERVER_ERROR_STATUS_MIN,
} from '../../constants';
import { ErrorCode } from '../../enums';
import { type ResolvedError } from '../../interfaces';

function messageOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') {
    return response;
  }
  if ('message' in response) {
    const { message } = response;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
      return message.join('; ');
    }
  }
  return exception.message;
}

function codeFor(status: number): ErrorCode {
  const known = ERROR_CODE_BY_HTTP_STATUS.get(status);
  if (known !== undefined) {
    return known;
  }
  return status >= SERVER_ERROR_STATUS_MIN ? ErrorCode.InternalError : ErrorCode.BadRequest;
}

export function mapHttpException(exception: unknown): ResolvedError | null {
  if (!(exception instanceof HttpException)) {
    return null;
  }
  const status = exception.getStatus();
  const code = codeFor(status);
  const isServerError = status >= SERVER_ERROR_STATUS_MIN;
  const generic = GENERIC_ERROR_MESSAGES[code];
  const message = messageOf(exception);
  const isBareUnauthorized = code === ErrorCode.Unauthorized && message === 'Unauthorized';
  const useGeneric = isServerError || code === ErrorCode.RateLimited || isBareUnauthorized;
  return {
    status,
    code,
    message: useGeneric && generic !== undefined ? generic : message,
  };
}
