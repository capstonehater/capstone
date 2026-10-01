import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { isPermissionKey } from '../auth/rbac/permission-catalog';
import { AssignUserRoleDto } from './dto/assign-user-role.dto';

const memberships = {
  include: {
    role: { include: { permissions: { include: { permission: true } } } },
  },
  orderBy: { assignedAt: 'asc' as const },
};
@Injectable()
export class UserRolesService {
  constructor(private readonly prisma: PrismaService) {}
  private async assertActor(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedUser,
  ) {
    const user = await tx.user.findUnique({ where: { id: actor.id } });
    if (
      actor.role !== Role.ADMINISTRATOR ||
      user?.role !== Role.ADMINISTRATOR ||
      user.accountStatus !== AccountStatus.ACTIVE ||
      !user.isActive
    )
      throw new ForbiddenException(
        'Only active Administrators can manage user roles.',
      );
  }
  async list(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        accountStatus: true,
        isActive: true,
        accessRoles: memberships,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const roles = user.accessRoles.map((membership) => ({
      id: membership.role.id,
      key: membership.role.key,
      name: membership.role.name,
      description: membership.role.description,
      isProtected: membership.role.isProtected,
      isCompatibility:
        membership.role.isSystem && membership.role.key === user.role,
      assignedAt: membership.assignedAt,
      assignedByUserId: membership.assignedByUserId,
    }));
    const permissions = [
      ...new Set(
        user.accessRoles
          .flatMap((membership) =>
            membership.role.permissions.map((grant) => grant.permission.key),
          )
          .filter(isPermissionKey),
      ),
    ].sort();
    return {
      roles,
      effectivePermissions:
        user.accountStatus === AccountStatus.ACTIVE && user.isActive
          ? permissions
          : [],
    };
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
      )
        throw new ConflictException(
          'Role assignments changed. Reload and try again.',
        );
      throw error;
    }
  }
  assign(id: string, dto: AssignUserRoleDto, actor: AuthenticatedUser) {
    if (Boolean(dto.roleId) === Boolean(dto.roleIds))
      throw new BadRequestException('Provide roleId or roleIds, not both.');
    const ids = dto.roleIds ?? [dto.roleId!];
    if (!ids.length || new Set(ids).size !== ids.length)
      throw new BadRequestException('Choose unique roles.');
    return this.transaction(async (tx) => {
      await this.assertActor(tx, actor);
      if (!(await tx.user.findUnique({ where: { id } })))
        throw new NotFoundException('User not found');
      const roles = await tx.accessRole.findMany({
        where: { id: { in: ids } },
      });
      if (roles.length !== ids.length)
        throw new NotFoundException('One or more roles no longer exist.');
      if (
        await tx.userRole.count({ where: { userId: id, roleId: { in: ids } } })
      )
        throw new ConflictException('One or more roles are already assigned.');
      await tx.userRole.createMany({
        data: ids.map((roleId) => ({
          userId: id,
          roleId,
          assignedByUserId: actor.id,
        })),
      });
      await tx.authorizationAuditEvent.create({
        data: {
          actorUserId: actor.id,
          targetUserId: id,
          action: 'user.roles.assigned',
          beforeState: { assigned: [] },
          afterState: { assigned: ids },
        },
      });
      await this.revoke(tx, id);
      return { assignedRoleIds: ids };
    });
  }
  remove(id: string, roleId: string, actor: AuthenticatedUser) {
    return this.transaction(async (tx) => {
      await this.assertActor(tx, actor);
      const user = await tx.user.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('User not found');
      const membership = await tx.userRole.findUnique({
        where: { userId_roleId: { userId: id, roleId } },
        include: { role: true },
      });
      if (!membership)
        throw new NotFoundException('Role is not assigned to this user.');
      if (
        membership.role.key === 'ADMINISTRATOR' &&
        user.accountStatus === AccountStatus.ACTIVE &&
        user.isActive
      ) {
        const others = await tx.user.count({
          where: {
            id: { not: id },
            accountStatus: AccountStatus.ACTIVE,
            isActive: true,
            accessRoles: {
              some: { role: { key: 'ADMINISTRATOR', isProtected: true } },
            },
          },
        });
        if (!others)
          throw new ConflictException(
            'At least one active Administrator membership must remain.',
          );
      }
      if (membership.role.isSystem && membership.role.key === user.role)
        throw new ConflictException(
          'This membership follows the legacy role. Change the legacy role using Edit User instead.',
        );
      await tx.userRole.delete({
        where: { userId_roleId: { userId: id, roleId } },
      });
      await tx.authorizationAuditEvent.create({
        data: {
          actorUserId: actor.id,
          targetUserId: id,
          targetRoleId: roleId,
          action: 'user.role.removed',
          beforeState: { roleId, key: membership.role.key },
          afterState: { removed: true },
        },
      });
      await this.revoke(tx, id);
      return { removed: true };
    });
  }
  private revoke(tx: Prisma.TransactionClient, userId: string) {
    return tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: 'role_membership_changed' },
    });
  }
}
