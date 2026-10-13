export interface RiskReviewConfig {
  workerEnabled: boolean;
  attempts: number;
  backoffMs: number;
  providerLatencyMs: number;
  providerFailureRate: number;
  providerTimeoutMs: number;
}
