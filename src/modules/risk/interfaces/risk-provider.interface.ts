import { type RiskAssessmentRequest } from './risk-assessment-request.interface';
import { type RiskAssessmentResult } from './risk-assessment-result.interface';

export interface RiskProvider {
  assess(request: RiskAssessmentRequest, signal: AbortSignal): Promise<RiskAssessmentResult>;
}
