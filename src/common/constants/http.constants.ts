export const REQUEST_ID_HEADER = 'x-request-id';
export const API_PREFIX = 'api';
export const API_DEFAULT_VERSION = '1';
export const HEALTH_ROUTES: readonly string[] = ['health/live', 'health/ready'];
export const JSON_BODY_LIMIT = '100kb';
export const BODY_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH']);
