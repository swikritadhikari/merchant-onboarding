export interface JwtConfig {
  secret: string;
  expiresInSeconds: number;
  issuer: string;
  audience: string;
}
