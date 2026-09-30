import {
  Body,
  Controller,
  Delete,
  Get,
  ForbiddenException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AccountStatus, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUserActivityDto } from './dto/list-user-activity.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { UserSessionParamDto } from './dto/user-session-param.dto';
import { AssignableUserRole } from './users.constants';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @RequirePermission('users.view')
  async listUsers(@Query() query: ListUsersDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  @RequirePermission('users.view')
  async getUser(@Param() params: UserIdParamDto) {
    return {
      user: await this.usersService.getUserDetail(params.id),
    };
  }

  @Post()
  @RequirePermission('users.manage')
  async createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    // Legacy role assignment remains Administrator-only, except baseline Staff creation.
    if (
      actor.role !== Role.ADMINISTRATOR &&
      dto.role !== AssignableUserRole.STAFF
    ) {
      throw new ForbiddenException(
        'Only Administrators can create privileged accounts',
      );
    }
    const user = await this.usersService.createUser(dto);

    await this.authService.issuePasswordResetForUserId(user.id, {
      allowedStatuses: [AccountStatus.PENDING],
      includeDebugDetails: false,
    });

    return {
      message: 'User created successfully',
      user,
    };
  }

  @Patch(':id')
  @RequirePermission('users.manage')
  async updateUser(
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    // The compatibility trigger turns scalar role edits into membership changes.
    if (dto.role !== undefined && actor.role !== Role.ADMINISTRATOR) {
      throw new ForbiddenException('Only Administrators can change user roles');
    }
    return {
      message: 'User updated successfully',
      user: await this.usersService.updateUser(params.id, dto, actor),
    };
  }

  @Post(':id/suspend')
  @RequirePermission('users.manage')
  async suspendUser(
    @Param() params: UserIdParamDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return {
      message: 'User suspended successfully',
      user: await this.usersService.suspendUser(params.id, actor),
    };
  }

  @Post(':id/reactivate')
  @RequirePermission('users.manage')
  async reactivateUser(@Param() params: UserIdParamDto) {
    return {
      message: 'User reactivated successfully',
      user: await this.usersService.reactivateUser(params.id),
    };
  }

  @Post(':id/password-reset')
  @RequirePermission('users.manage')
  async requestUserPasswordReset(@Param() params: UserIdParamDto) {
    await this.authService.issuePasswordResetForUserId(params.id, {
      allowedStatuses: [
        AccountStatus.PENDING,
        AccountStatus.ACTIVE,
        AccountStatus.INACTIVE,
      ],
      includeDebugDetails: false,
    });

    return {
      message: 'Password reset initiated successfully',
    };
  }

  @Get(':id/sessions')
  @RequirePermission('users.view')
  async listUserSessions(@Param() params: UserIdParamDto) {
    return this.usersService.listUserSessions(params.id);
  }

  @Delete(':id/sessions/:sessionId')
  @RequirePermission('users.sessions.revoke')
  async revokeUserSession(@Param() params: UserSessionParamDto) {
    return this.usersService.revokeUserSession(params.id, params.sessionId);
  }

  @Post(':id/sessions/revoke-all')
  @RequirePermission('users.sessions.revoke')
  async revokeAllUserSessions(@Param() params: UserIdParamDto) {
    return this.usersService.revokeAllUserSessions(params.id);
  }

  @Get(':id/activity')
  @RequirePermission('users.view')
  async listUserActivity(
    @Param() params: UserIdParamDto,
    @Query() query: ListUserActivityDto,
  ) {
    return this.usersService.listUserActivity(params.id, query);
  }

  @Delete(':id')
  @RequirePermission('users.manage')
  async deleteUser(
    @Param() params: UserIdParamDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.deleteUser(params.id, actor);
  }
}
