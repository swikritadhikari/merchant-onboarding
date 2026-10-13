import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../enums';
import { type ResolvedError } from '../../interfaces';
import { hasStringProperty } from '../../utils';

const BODY_PARSER_ERRORS: Readonly<Record<string, ResolvedError>> = {
  'entity.parse.failed': {
    status: HttpStatus.BAD_REQUEST,
    code: ErrorCode.BadRequest,
    message: 'Request body is not valid JSON',
  },
  'entity.too.large': {
    status: HttpStatus.PAYLOAD_TOO_LARGE,
    code: ErrorCode.PayloadTooLarge,
    message: 'Request body is too large',
  },
  'encoding.unsupported': {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    code: ErrorCode.UnsupportedMediaType,
    message: 'Unsupported content encoding',
  },
  'charset.unsupported': {
    status: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
    code: ErrorCode.UnsupportedMediaType,
    message: 'Unsupported charset',
  },
  'request.aborted': {
    status: HttpStatus.BAD_REQUEST,
    code: ErrorCode.BadRequest,
    message: 'Request was aborted by the client',
  },
  'request.size.invalid': {
    status: HttpStatus.BAD_REQUEST,
    code: ErrorCode.BadRequest,
    message: 'Request size did not match Content-Length',
  },
};

export function mapBodyParserError(exception: unknown): ResolvedError | null {
  if (!hasStringProperty(exception, 'type')) {
    return null;
  }
  return BODY_PARSER_ERRORS[exception.type] ?? null;
}
