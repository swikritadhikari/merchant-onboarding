import { type ErrorCode } from '../enums';
import { type ErrorDetail } from './error-detail.interface';

export interface ResolvedError {
  status: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
  retryAfterSeconds?: number;
}
