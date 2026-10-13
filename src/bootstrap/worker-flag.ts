export function isWorkerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.RISK_WORKER_ENABLED !== 'false';
}
