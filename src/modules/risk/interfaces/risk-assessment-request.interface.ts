import { type BusinessType } from '../../applications/enums';

export interface RiskAssessmentRequest {
  idempotencyKey: string;
  legalBusinessName: string;
  businessType: BusinessType;
  taxId: string;
  mcc: string;
  monthlyVolumeMinor: number;
}
