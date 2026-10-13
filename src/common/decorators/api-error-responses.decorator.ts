import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiServiceUnavailableResponse,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto';

export const ApiErrorResponses = (): ClassDecorator & MethodDecorator =>
  applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Invalid request or body' }),
    ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Missing or invalid token' }),
    ApiForbiddenResponse({ type: ErrorResponseDto, description: 'Not allowed for this caller' }),
    ApiUnsupportedMediaTypeResponse({ type: ErrorResponseDto, description: 'Body is not JSON' }),
    ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Rate limited' }),
    ApiInternalServerErrorResponse({ type: ErrorResponseDto, description: 'Unexpected error' }),
    ApiServiceUnavailableResponse({
      type: ErrorResponseDto,
      description: 'Dependency temporarily unavailable; honour Retry-After',
    }),
  );
