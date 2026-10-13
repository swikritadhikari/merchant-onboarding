export enum RefreshTokenRevocationReason {
  Rotated = 'ROTATED',
  Logout = 'LOGOUT',
  ReuseDetected = 'REUSE_DETECTED',
  UserInactive = 'USER_INACTIVE',
}

export const SESSION_ENDING_REASONS: readonly RefreshTokenRevocationReason[] = [
  RefreshTokenRevocationReason.Logout,
  RefreshTokenRevocationReason.ReuseDetected,
  RefreshTokenRevocationReason.UserInactive,
];
