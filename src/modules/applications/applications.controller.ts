import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuditLogResponseDto } from '../audit/dto';
import { type AuthenticatedUser } from '../auth/interfaces';
import { ApiErrorResponses, CurrentUser, Roles, UuidParam } from '../../common/decorators';
import { ErrorResponseDto } from '../../common/dto';
import { Role } from '../users/enums';
import { ApplicationsService } from './applications.service';
import {
  ApplicationPageDto,
  ApplicationResponseDto,
  AssignReviewerDto,
  CreateApplicationDto,
  ListApplicationsQueryDto,
  ReviewDecisionDto,
  UpdateApplicationDto,
} from './dto';

@ApiTags('applications')
@ApiBearerAuth()
@ApiNotFoundResponse({
  type: ErrorResponseDto,
  description: 'Application does not exist or is not visible to the caller',
})
@ApiErrorResponses()
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  @Roles(Role.Sales, Role.Admin)
  @ApiOperation({ summary: 'Create a draft merchant application' })
  @ApiCreatedResponse({ type: ApplicationResponseDto })
  public async create(
    @Body() dto: CreateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.from(await this.applicationsService.create(dto, user));
  }

  @Get()
  @ApiOperation({ summary: 'List applications visible to the caller (SALES: own only)' })
  @ApiOkResponse({ type: ApplicationPageDto })
  public async list(
    @Query() query: ListApplicationsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationPageDto> {
    const { data, meta } = await this.applicationsService.list(query, user);
    return { data: data.map((app) => ApplicationResponseDto.from(app)), meta };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one application' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  public async findOne(
    @UuidParam() id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.from(await this.applicationsService.findOne(id, user));
  }

  @Patch(':id')
  @Roles(Role.Sales, Role.Admin)
  @ApiOperation({ summary: 'Update an application while it is DRAFT or INFO_REQUESTED' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Application is not editable in its current status',
  })
  public async update(
    @UuidParam() id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.from(await this.applicationsService.update(id, dto, user));
  }

  @Post(':id/submit')
  @Roles(Role.Sales, Role.Admin)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Submit for asynchronous risk review' })
  @ApiAcceptedResponse({ type: ApplicationResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Invalid state transition' })
  public async submit(
    @UuidParam() id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.from(await this.applicationsService.submit(id, user));
  }

  @Post(':id/assign')
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a reviewer (ADMIN only)' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: 'Assignee is not an active reviewer',
  })
  public async assign(
    @UuidParam() id: string,
    @Body() dto: AssignReviewerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.from(
      await this.applicationsService.assignReviewer(id, dto.reviewerId, user),
    );
  }

  @Post(':id/decision')
  @Roles(Role.Reviewer)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve, reject or request info (assigned reviewer only)' })
  @ApiOkResponse({ type: ApplicationResponseDto })
  @ApiForbiddenResponse({
    type: ErrorResponseDto,
    description: 'Caller is not the assigned reviewer',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Application is not awaiting a decision',
  })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: 'Decision is missing a required note',
  })
  public async decide(
    @UuidParam() id: string,
    @Body() dto: ReviewDecisionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplicationResponseDto> {
    return ApplicationResponseDto.from(
      await this.applicationsService.recordDecision(id, dto, user),
    );
  }

  @Get(':id/audit-events')
  @Roles(Role.Admin, Role.Reviewer)
  @ApiOperation({ summary: 'Audit trail for an application' })
  @ApiOkResponse({ type: [AuditLogResponseDto] })
  public async auditTrail(
    @UuidParam() id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuditLogResponseDto[]> {
    const logs = await this.applicationsService.auditTrail(id, user);
    return logs.map((log) => AuditLogResponseDto.from(log));
  }
}
