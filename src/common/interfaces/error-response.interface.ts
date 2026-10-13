import { type ErrorCode } from '../enums';
import { type ErrorDetail } from './error-detail.interface';

export interface ErrorDebugInfo {
  name: string;
  message: string;
}

export interface ErrorResponse {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
  path: string;
  method: string;
  requestId: string | undefined;
  timestamp: string;
  debug?: ErrorDebugInfo;
}
