import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../../config/app-config.service';
import { type User } from '../users/entities';
import { UsersService } from '../users/users.service';
import { TIMING_SAFE_DUMMY_HASH } from './constants';
import { type TokenResponseDto } from './dto';
import { type IssuedRefreshToken, type JwtPayload } from './interfaces';
import { RefreshTokenService } from './refresh-token.service';
import { TokenDenylistService } from './token-denylist.service';

const MILLISECONDS_PER_SECOND = 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly denylist: TokenDenylistService,
    private readonly config: AppConfigService,
  ) {}

  public async login(email: string, password: string): Promise<TokenResponseDto> {
    const user = await this.usersService.findActiveByEmailWithPassword(email);
    const passwordMatches = await compare(password, user?.passwordHash ?? TIMING_SAFE_DUMMY_HASH);

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.tokensFor(user, await this.refreshTokenService.issue(user.id));
  }

  public async refresh(refreshToken: string): Promise<TokenResponseDto> {
    const result = await this.refreshTokenService.rotate(refreshToken);
    if (result.ok) {
      return this.tokensFor(result.user, result.refreshToken);
    }
    if ('revokedSessionId' in result) {
      await this.denylist.denySessions([result.revokedSessionId]);
    }
    throw new UnauthorizedException('Invalid refresh token');
  }

  public async logout(refreshToken: string): Promise<void> {
    const sessionId = await this.refreshTokenService.revokeSession(refreshToken);
    if (sessionId !== null) {
      await this.denylist.denySessions([sessionId]);
    }
  }

  public async logoutEverywhere(userId: string): Promise<void> {
    const sessionIds = await this.refreshTokenService.revokeAllSessions(userId);
    await this.denylist.denySessions(sessionIds);
  }

  private async tokensFor(user: User, refreshToken: IssuedRefreshToken): Promise<TokenResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role,
      sid: refreshToken.sessionId,
      jti: randomUUID(),
    };
    const refreshExpiresInMs = refreshToken.expiresAt.getTime() - Date.now();
    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: 'Bearer',
      expiresIn: this.config.jwt.expiresInSeconds,
      refreshToken: refreshToken.token,
      refreshExpiresIn: Math.max(0, Math.floor(refreshExpiresInMs / MILLISECONDS_PER_SECOND)),
    };
  }
}
