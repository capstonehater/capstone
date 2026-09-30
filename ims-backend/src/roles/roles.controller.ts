import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  DeleteRoleDto,
  RoleIdDto,
  UpdateRoleDto,
} from './roles.dto';
@Controller('roles')
@Roles(Role.ADMINISTRATOR)
export class RolesController {
  constructor(private readonly service: RolesService) {}
  @Get() async list() {
    return { roles: await this.service.list() };
  }
  @Get('permissions') async permissions() {
    return { permissions: await this.service.permissions() };
  }
  @Post() async create(
    @Body() dto: CreateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { role: await this.service.create(dto, actor.id) };
  }
  @Patch(':id') async update(
    @Param() params: RoleIdDto,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return { role: await this.service.update(params.id, dto, actor.id) };
  }
  @Delete(':id') async remove(
    @Param() params: RoleIdDto,
    @Body() dto: DeleteRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.service.remove(params.id, dto.revision, actor.id);
  }
}
