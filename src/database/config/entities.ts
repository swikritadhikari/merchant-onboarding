import { MerchantApplication } from '../../modules/applications/entities';
import { AuditLog } from '../../modules/audit/entities';
import { RefreshToken } from '../../modules/auth/entities';
import { RiskAssessment } from '../../modules/risk/entities';
import { User } from '../../modules/users/entities';

export const ENTITIES = [
  User,
  RefreshToken,
  MerchantApplication,
  RiskAssessment,
  AuditLog,
] as const;
