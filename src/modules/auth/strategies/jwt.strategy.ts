import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfigService } from '../../../config/app-config.service';
import { UsersService } from '../../users/users.service';
import { JWT_ALGORITHM } from '../constants';
import { type AuthenticatedUser, type JwtPayload } from '../interfaces';
import { TokenDenylistService } from '../token-denylist.service';

function isJwtPayload(payload: Partial<JwtPayload>): payload is JwtPayload {
  return (
    typeof payload.sub === 'string' &&
    typeof payload.sid === 'string' &&
    typeof payload.jti === 'string'
  );
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: AppConfigService,
    private readonly usersService: UsersService,
    private readonly denylist: TokenDenylistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwt.secret,
      algorithms: [JWT_ALGORITHM],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });
  }

  public async validate(payload: Partial<JwtPayload>): Promise<AuthenticatedUser> {
    if (!isJwtPayload(payload)) {
      throw new UnauthorizedException();
    }
    if (await this.denylist.isSessionDenied(payload.sid)) {
      throw new UnauthorizedException();
    }

    const principal = await this.usersService.findActivePrincipal(payload.sub);
    if (!principal) {
      throw new UnauthorizedException();
    }
    return principal;
  }
}
