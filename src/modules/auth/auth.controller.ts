import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiErrorResponses, AuthRateLimit, CurrentUser, Public } from '../../common/decorators';
import { ErrorResponseDto } from '../../common/dto';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, TokenResponseDto } from './dto';
import { type AuthenticatedUser } from './interfaces';

@ApiTags('auth')
@ApiErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @AuthRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for an access token and a refresh token' })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Invalid email or password' })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto, description: 'Too many login attempts' })
  public login(@Body() dto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @AuthRateLimit()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate a refresh token',
    description:
      'Returns a new access token and a new refresh token. The presented refresh token is ' +
      'invalidated; presenting it again revokes the whole session.',
  })
  @ApiOkResponse({ type: TokenResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Refresh token is unknown, expired, revoked or reused',
  })
  public refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke the session that the refresh token belongs to',
    description: 'Access tokens issued for the session stop working immediately.',
  })
  @ApiNoContentResponse({ description: 'Always returned, whether or not the token was valid' })
  public async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign out of every session',
    description:
      'Revokes all refresh tokens of the caller and immediately invalidates every access token issued for them.',
  })
  @ApiNoContentResponse()
  public async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.logoutEverywhere(user.id);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Return the authenticated principal' })
  public me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
