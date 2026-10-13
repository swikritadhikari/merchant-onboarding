import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import { describeError } from '../utils';
import { debugInfoFor, logResolvedError, writeErrorResponse } from './error-response.writer';
import { resolveError } from './mappers';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly config: AppConfigService) {}

  public catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(`Unhandled ${host.getType()} error: ${describeError(exception)}`);
      throw exception;
    }

    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const resolved = resolveError(exception);
    logResolvedError(this.logger, resolved, exception, request);
    writeErrorResponse(
      response,
      request,
      resolved,
      debugInfoFor(exception, resolved, this.config.isDevelopment),
    );
  }
}
