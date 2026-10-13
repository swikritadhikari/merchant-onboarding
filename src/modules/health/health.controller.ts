import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { type Response } from 'express';
import { Public } from '../../common/decorators';
import { HealthResponseDto } from './dto';
import { HealthStatus } from './enums';
import { HealthService } from './health.service';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe: the process is running' })
  @ApiOkResponse({ type: HealthResponseDto })
  public live(): HealthResponseDto {
    return this.healthService.liveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe: dependencies reachable and not shutting down' })
  @ApiOkResponse({ type: HealthResponseDto })
  @ApiServiceUnavailableResponse({ type: HealthResponseDto })
  public async ready(@Res({ passthrough: true }) response: Response): Promise<HealthResponseDto> {
    const result = await this.healthService.readiness();
    if (result.status !== HealthStatus.Ok) {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
