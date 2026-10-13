import { type RiskLevel } from '../enums';

export interface NewRiskAssessment {
  applicationId: string;
  submissionNo: number;
  provider: string;
  providerReference: string;
  score: number;
  riskLevel: RiskLevel;
  reasons: string[];
  attempt: number;
}
