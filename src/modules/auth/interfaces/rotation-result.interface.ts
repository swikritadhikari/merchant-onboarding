import { type User } from '../../users/entities';
import { type IssuedRefreshToken } from './issued-refresh-token.interface';

export interface RotationSucceeded {
  ok: true;
  user: User;
  refreshToken: IssuedRefreshToken;
}

export interface RotationRejected {
  ok: false;
  reason: 'unknown' | 'expired' | 'revoked';
}

export interface RotationRevokedSession {
  ok: false;
  reason: 'reused' | 'user_inactive';
  revokedSessionId: string;
}

export type RotationResult = RotationSucceeded | RotationRejected | RotationRevokedSession;
