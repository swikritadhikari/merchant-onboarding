export const PG_ERROR = {
  UniqueViolation: '23505',
  ForeignKeyViolation: '23503',
  CheckViolation: '23514',
  NotNullViolation: '23502',
  InvalidTextRepresentation: '22P02',
  NumericValueOutOfRange: '22003',
  StringDataRightTruncation: '22001',
  InvalidDatetimeFormat: '22007',
  SerializationFailure: '40001',
  DeadlockDetected: '40P01',
  LockNotAvailable: '55P03',
  QueryCanceled: '57014',
  AdminShutdown: '57P01',
  CrashShutdown: '57P02',
  CannotConnectNow: '57P03',
  TooManyConnections: '53300',
} as const;

export const PG_CONNECTION_EXCEPTION_CLASS = '08';

export const NETWORK_ERROR_CODES: ReadonlySet<string> = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'EAI_AGAIN',
]);

export const CONSTRAINT_MESSAGES: Readonly<Record<string, string>> = {
  uq_users_email: 'A user with this email already exists',
  uq_risk_assessments_application_submission: 'This submission has already been assessed',
  uq_refresh_tokens_token_hash: 'Token collision, please retry',
};
