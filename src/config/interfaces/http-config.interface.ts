export interface HttpConfig {
  corsOrigins: readonly string[];
  trustProxy: boolean | number | string;
  requestTimeoutMs: number;
  swaggerEnabled: boolean;
  rateLimitPerMinute: number;
  authRateLimitPerMinute: number;
}
