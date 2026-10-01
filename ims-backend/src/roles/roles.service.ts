import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { isPermissionKey } from '../auth/rbac/permission-catalog';
import { CreateRoleDto, UpdateRoleDto } from './roles.dto';

const include = {
  permissions: { include: { permission: true } },
  _count: { select: { members: true } },
} satisfies Prisma.AccessRoleInclude;
type RoleRow = Prisma.AccessRoleGetPayload<{ include: typeof include }>;
function serialize(role: RoleRow) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    isProtected: role.isProtected,
    revision: role.revision,
    memberCount: role._count.members,
    permissionKeys: role.permissions
      .map((grant) => grant.permission.key)
      .sort(),
  };
}
function auditState(role: RoleRow): Prisma.InputJsonObject {
  return {
    name: role.name,
    description: role.description,
    key: role.key,
    permissionKeys: role.permissions
      .map((grant) => grant.permission.key)
      .sort(),
    revision: role.revision,
  };
}
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}
  async list() {
    return (
      await this.prisma.accessRole.findMany({
        include,
        orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }, { name: 'asc' }],
      })
    ).map(serialize);
  }
  async permissions() {
    return (
      await this.prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { label: 'asc' }],
      })
    ).filter((permission) => isPermissionKey(permission.key));
  }
  private async permissionIds(tx: Prisma.TransactionClient, keys: string[]) {
    if (keys.some((key) => !isPermissionKey(key)))
      throw new BadRequestException('Unknown permission key');
    const permissions = await tx.permission.findMany({
      where: { key: { in: keys } },
    });
    if (permissions.length !== keys.length)
      throw new BadRequestException(
        'Permission catalog changed. Reload and try again.',
      );
    return permissions.map((permission) => permission.id);
  }
  private async uniqueName(
    tx: Prisma.TransactionClient,
    name: string,
    exceptId?: string,
  ) {
    if (
      await tx.accessRole.findFirst({
        where: {
          name: { equals: name, mode: 'insensitive' },
          ...(exceptId ? { id: { not: exceptId } } : {}),
        },
      })
    ) {
      throw new ConflictException('A role with this name already exists.');
    }
  }
  private async transaction<T>(
    action: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(action, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034', 'P2003'].includes(error.code)
      ) {
        throw new ConflictException(
          'The role changed or its name is already in use. Reload and try again.',
        );
      }
      throw error;
    }
  }
  create(dto: CreateRoleDto, actorId: string) {
    return this.transaction(async (tx) => {
      await this.uniqueName(tx, dto.name);
      const ids = await this.permissionIds(tx, dto.permissionKeys);
      const role = await tx.accessRole.create({
        data: {
          name: dto.name,
          description: dto.description,
          key: `custom:${randomUUID()}`,
          permissions: {
            create: ids.map((permissionId) => ({ permissionId })),
          },
        },
        include,
      });
      await tx.authorizationAuditEvent.create({
        data: {
          actorUserId: actorId,
          targetRoleId: role.id,
          action: 'role.created',
          afterState: auditState(role),
        },
      });
      return serialize(role);
    });
  }
  update(id: string, dto: UpdateRoleDto, actorId: string) {
    return this.transaction(async (tx) => {
      const before = await tx.accessRole.findUnique({ where: { id }, include });
      if (!before) throw new NotFoundException('Role not found');
      if (before.key === 'ADMINISTRATOR' && dto.permissionKeys.length === 0)
        throw new BadRequestException(
          'Administrator must retain at least one permission.',
        );
      await this.uniqueName(tx, dto.name, id);
      const ids = await this.permissionIds(tx, dto.permissionKeys);
      const result = await tx.accessRole.updateMany({
        where: { id, revision: dto.revision },
        data: {
          name: dto.name,
          description: dto.description,
          revision: { increment: 1 },
        },
      });
      if (!result.count)
        throw new ConflictException(
          'This role was changed by another administrator. Reload before saving.',
        );
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: id, permissionId })),
      });
      const after = await tx.accessRole.findUniqueOrThrow({
        where: { id },
        include,
      });
      await tx.authorizationAuditEvent.create({
        data: {
          actorUserId: actorId,
          targetRoleId: id,
          action: 'role.updated',
          beforeState: auditState(before),
          afterState: auditState(after),
        },
      });
      return serialize(after);
    });
  }
  remove(id: string, revision: number, actorId: string) {
    return this.transaction(async (tx) => {
      const role = await tx.accessRole.findUnique({ where: { id }, include });
      if (!role) throw new NotFoundException('Role not found');
      if (role.isProtected || role.isSystem)
        throw new BadRequestException(
          'Protected system roles cannot be deleted.',
        );
      if (role._count.members)
        throw new ConflictException(
          'This role has members and cannot be deleted.',
        );
      if (role.revision !== revision)
        throw new ConflictException(
          'This role has changed. Reload before deleting.',
        );
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.accessRole.delete({ where: { id, revision } });
      await tx.authorizationAuditEvent.create({
        data: {
          actorUserId: actorId,
          targetRoleId: id,
          action: 'role.deleted',
          beforeState: auditState(role),
        },
      });
      return { deleted: true };
    });
  }
}
