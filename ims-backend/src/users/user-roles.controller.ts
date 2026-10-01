import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UserIdParamDto } from './dto/user-id-param.dto';
import {
  AssignUserRoleDto,
  UserRoleParamsDto,
} from './dto/assign-user-role.dto';
import { UserRolesService } from './user-roles.service';
@Controller('users')
@Roles(Role.ADMINISTRATOR)
export class UserRolesController {
  constructor(private readonly service: UserRolesService) {}
  @Get(':id/roles') list(@Param() params: UserIdParamDto) {
    return this.service.list(params.id);
  }
  @Post(':id/roles') assign(
    @Param() params: UserIdParamDto,
    @Body() dto: AssignUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.assign(params.id, dto, actor);
  }
  @Delete(':id/roles/:roleId') remove(
    @Param() params: UserRoleParamsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.remove(params.id, params.roleId, actor);
  }
}
