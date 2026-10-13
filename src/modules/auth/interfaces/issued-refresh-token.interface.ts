export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
  sessionId: string;
}

export interface PersistedRefreshToken {
  id: string;
  issued: IssuedRefreshToken;
}
