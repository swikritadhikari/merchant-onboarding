export const TIMING_SAFE_DUMMY_HASH =
  '$2b$12$Kq/LFa78WllwEGy9wbh3zuTnZ1Ju9HLc6Coxu/XS1ULhl2rzSnMli';
export const REFRESH_TOKEN_BYTES = 32;
export const DENYLIST_CLOCK_SKEW_SECONDS = 60;
export const JWT_ALGORITHM = 'HS256';

export const sessionDenylistKey = (sessionId: string): string => `denylist:session:${sessionId}`;
