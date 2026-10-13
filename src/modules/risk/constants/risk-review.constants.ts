export const RISK_REVIEW_QUEUE = 'risk-review';
export const RISK_PROVIDER = Symbol('RISK_PROVIDER');

export const RISK_WORKER_CONCURRENCY = 5;
export const RECONCILE_EVERY_MS = 60_000;
export const STUCK_SUBMISSION_AFTER_MS = 10 * 60_000;
export const RECONCILE_BATCH_SIZE = 100;

export const COMPLETED_JOB_RETENTION = { age: 24 * 3600, count: 1000 } as const;
export const FAILED_JOB_RETENTION = { age: 7 * 24 * 3600 } as const;
