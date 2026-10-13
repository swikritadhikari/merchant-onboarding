import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { type AuthenticatedUser } from '../auth/interfaces';
import { ApiErrorResponses, CurrentUser, Roles, UuidParam } from '../../common/decorators';
import { ErrorResponseDto } from '../../common/dto';
import { ListUsersQueryDto, UpdateUserDto, UserResponseDto } from './dto';
import { Role } from './enums';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(Role.Admin)
@ApiErrorResponses()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List active users (e.g. ?role=REVIEWER to pick an assignee)' })
  @ApiOkResponse({ type: [UserResponseDto] })
  public list(@Query() query: ListUsersQueryDto): Promise<UserResponseDto[]> {
    return this.usersService.list(query.role);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change a user’s role or deactivate them (takes effect immediately)' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'User not found' })
  @ApiUnprocessableEntityResponse({
    type: ErrorResponseDto,
    description: 'Administrators cannot deactivate or demote themselves',
  })
  public async update(
    @UuidParam() id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return UserResponseDto.from(await this.usersService.update(id, dto, actor));
  }
}
