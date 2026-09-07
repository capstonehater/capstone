import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AccountStatus, Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUserActivityDto } from './dto/list-user-activity.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserIdParamDto } from './dto/user-id-param.dto';
import { UserSessionParamDto } from './dto/user-session-param.dto';
import { UsersService } from './users.service';

@Controller('users')
@Roles(Role.ADMINISTRATOR)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  async listUsers(@Query() query: ListUsersDto) {
    return this.usersService.listUsers(query);
  }

  @Get(':id')
  async getUser(@Param() params: UserIdParamDto) {
    return {
      user: await this.usersService.getUserDetail(params.id),
    };
  }

  @Post()
  async createUser(@Body() dto: CreateUserDto) {
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
  async updateUser(
    @Param() params: UserIdParamDto,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return {
      message: 'User updated successfully',
      user: await this.usersService.updateUser(params.id, dto, actor),
    };
  }

  @Post(':id/suspend')
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
  async reactivateUser(@Param() params: UserIdParamDto) {
    return {
      message: 'User reactivated successfully',
      user: await this.usersService.reactivateUser(params.id),
    };
  }

  @Post(':id/password-reset')
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
  async listUserSessions(@Param() params: UserIdParamDto) {
    return this.usersService.listUserSessions(params.id);
  }

  @Delete(':id/sessions/:sessionId')
  async revokeUserSession(@Param() params: UserSessionParamDto) {
    return this.usersService.revokeUserSession(params.id, params.sessionId);
  }

  @Post(':id/sessions/revoke-all')
  async revokeAllUserSessions(@Param() params: UserIdParamDto) {
    return this.usersService.revokeAllUserSessions(params.id);
  }

  @Get(':id/activity')
  async listUserActivity(
    @Param() params: UserIdParamDto,
    @Query() query: ListUserActivityDto,
  ) {
    return this.usersService.listUserActivity(params.id, query);
  }

  @Delete(':id')
  async deleteUser(
    @Param() params: UserIdParamDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.deleteUser(params.id, actor);
  }
}
