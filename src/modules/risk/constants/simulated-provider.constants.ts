export const SIMULATED_PROVIDER_NAME = 'simulated-kyb';
export const HIGH_RISK_MCCS: ReadonlySet<string> = new Set([
  '7995',
  '5967',
  '6051',
  '4829',
  '5993',
]);
export const HIGH_VOLUME_THRESHOLD_MINOR = 100_000_000;

export const BASE_SCORE_RANGE = 50;
export const HIGH_RISK_MCC_PENALTY = 35;
export const HIGH_VOLUME_PENALTY = 15;
export const SOLE_PROPRIETORSHIP_PENALTY = 5;
export const MAX_SCORE = 100;

export const HIGH_RISK_THRESHOLD = 70;
export const MEDIUM_RISK_THRESHOLD = 40;
