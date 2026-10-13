import { type RiskLevel } from '../enums';

export interface RiskAssessmentResult {
  provider: string;
  providerReference: string;
  score: number;
  level: RiskLevel;
  reasons: string[];
}
