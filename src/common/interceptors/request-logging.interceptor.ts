import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type Observable, tap } from 'rxjs';
import { REQUEST_ID_HEADER } from '../constants';
import { getRequestUser } from '../utils';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    const log = (): void => {
      const user = getRequestUser(request);
      const userPart = user ? ` userId=${user.id}` : '';
      const requestId = request.header(REQUEST_ID_HEADER) ?? 'none';
      this.logger.log(
        `${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms requestId=${requestId}${userPart}`,
      );
    };

    return next.handle().pipe(tap({ next: log, error: log }));
  }
}
