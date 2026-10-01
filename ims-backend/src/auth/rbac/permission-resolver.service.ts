import { Injectable } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { isPermissionKey, type PermissionKey } from './permission-catalog';
export type AuthorizationSnapshot = {
  roles: { id: string; key: string; name: string; description: string }[];
  effectivePermissions: PermissionKey[];
  authorizationRevision: string;
};
@Injectable()
export class PermissionResolver {
  constructor(private readonly prisma: PrismaService) {}
  async resolve(
    user: Pick<AuthenticatedUser, 'id'>,
  ): Promise<ReadonlySet<PermissionKey>> {
    return new Set((await this.snapshot(user)).effectivePermissions);
  }
  async snapshot(
    user: Pick<AuthenticatedUser, 'id'>,
  ): Promise<AuthorizationSnapshot> {
    // One fresh read supplies both role metadata and permission grants.
    const current = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        isActive: true,
        accountStatus: true,
        accessRoles: {
          select: {
            assignedAt: true,
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                description: true,
                revision: true,
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
          },
        },
      },
    });
    const memberships = [...(current?.accessRoles ?? [])].sort((a, b) =>
      a.role.id.localeCompare(b.role.id),
    );
    const roles = memberships.map(({ role }) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
    }));
    const grants = new Set<PermissionKey>();
    if (current?.isActive && current.accountStatus === AccountStatus.ACTIVE) {
      for (const membership of memberships)
        for (const grant of membership.role.permissions) {
          if (isPermissionKey(grant.permission.key))
            grants.add(grant.permission.key);
        }
    }
    const effectivePermissions = [...grants].sort();
    const authorizationRevision = createHash('sha256')
      .update(
        JSON.stringify({
          userId: user.id,
          active: current?.isActive ?? false,
          status: current?.accountStatus ?? null,
          roles,
          versions: memberships.map((membership) => ({
            revision: membership.role.revision,
            assignedAt: membership.assignedAt,
          })),
          effectivePermissions,
        }),
      )
      .digest('hex');
    return { roles, effectivePermissions, authorizationRevision };
  }
}
