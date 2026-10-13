import { type RiskLevel } from '../enums';

export interface AssessCompleted {
  outcome: 'completed';
  riskLevel: RiskLevel;
  score: number;
}

export interface AssessSkipped {
  outcome: 'skipped';
  reason: 'not_found' | 'stale_submission' | 'already_assessed';
}

export type AssessOutcome = AssessCompleted | AssessSkipped;

export interface ReconcileOutcome {
  requeued: number;
}
