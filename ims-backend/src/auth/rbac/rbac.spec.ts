import 'reflect-metadata';
import {
  ExecutionContext,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccountStatus, Role } from '@prisma/client';
import { PermissionResolver } from './permission-resolver.service';
import { PermissionsGuard } from '../guards/permissions.guard';
import { RolesGuard } from '../guards/roles.guard';
import { RequirePermission } from '../decorators/require-permission.decorator';
import { Roles } from '../decorators/roles.decorator';
import { Public } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { PermissionKey, PERMISSION_CATALOG } from './permission-catalog';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const user: AuthenticatedUser = {
  id: 'user',
  email: 'test@example.invalid',
  name: 'Test',
  role: Role.STAFF,
  isActive: true,
  sessionId: 'session',
};
class Fixture {
  @RequirePermission('inventory.waste') waste() {}
  @RequirePermission('inventory.view', 'inventory.waste') both() {}
  @Roles(Role.ADMINISTRATOR) legacy() {}
  @Roles(Role.STAFF) @RequirePermission('inventory.waste') conflict() {}
  @Public() @RequirePermission('inventory.waste') publicConflict() {}
  plain() {}
}
function context(
  method: keyof Fixture,
  principal: AuthenticatedUser | null = user,
): ExecutionContext {
  return {
    getHandler: () => Fixture.prototype[method],
    getClass: () => Fixture,
    switchToHttp: () => ({ getRequest: () => ({ user: principal }) }),
  } as unknown as ExecutionContext;
}
function record(...roles: string[][]) {
  return {
    isActive: true,
    accountStatus: AccountStatus.ACTIVE,
    accessRoles: roles.map((keys, index) => ({
      assignedAt: new Date('2026-01-01'),
      role: {
        id: String(index),
        key: String(index),
        name: 'Test',
        description: '',
        revision: 1,
        permissions: keys.map((key) => ({ permission: { key } })),
      },
    })),
  };
}
describe('RBAC foundation', () => {
  const findUnique = jest.fn();
  const resolver = new PermissionResolver({
    user: { findUnique },
  } as unknown as PrismaService);
  const guard = new PermissionsGuard(new Reflector(), resolver);
  beforeEach(() => findUnique.mockReset());
  it('allows a role grant', async () => {
    findUnique.mockResolvedValue(record(['inventory.waste']));
    await expect(guard.canActivate(context('waste'))).resolves.toBe(true);
  });
  it('blocks a missing grant', async () => {
    findUnique.mockResolvedValue(record(['inventory.view']));
    await expect(guard.canActivate(context('waste'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('unions and deduplicates multiple role grants', async () => {
    findUnique.mockResolvedValue(
      record(['inventory.view'], ['inventory.view', 'inventory.waste']),
    );
    expect(await resolver.resolve(user)).toEqual(
      new Set(['inventory.view', 'inventory.waste']),
    );
    await expect(guard.canActivate(context('both'))).resolves.toBe(true);
  });
  it('requires all declared grants', async () => {
    findUnique.mockResolvedValue(record(['inventory.view']));
    await expect(guard.canActivate(context('both'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('does not fall back to legacy Administrator grants', async () => {
    findUnique.mockResolvedValue(record());
    expect(
      await resolver.resolve({ ...user, role: Role.ADMINISTRATOR }),
    ).toEqual(new Set());
  });
  it.each([
    null,
    { ...record(['inventory.waste']), isActive: false },
    { ...record(['inventory.waste']), accountStatus: AccountStatus.INACTIVE },
  ])('blocks missing/inactive users', async (value) => {
    findUnique.mockResolvedValue(value);
    expect(await resolver.resolve(user)).toEqual(new Set());
  });
  it('uses fresh database grants after revocation', async () => {
    findUnique
      .mockResolvedValueOnce(record(['inventory.waste']))
      .mockResolvedValueOnce(record());
    await expect(guard.canActivate(context('waste'))).resolves.toBe(true);
    await expect(guard.canActivate(context('waste'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('preserves legacy access decisions without reading new tables', async () => {
    await expect(guard.canActivate(context('legacy'))).resolves.toBe(true);
    await expect(guard.canActivate(context('plain'))).resolves.toBe(true);
    const legacy = new RolesGuard(new Reflector());
    expect(() => legacy.canActivate(context('legacy'))).toThrow(
      ForbiddenException,
    );
    expect(
      legacy.canActivate(
        context('legacy', { ...user, role: Role.ADMINISTRATOR }),
      ),
    ).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('rejects unknown and empty keys at declaration', () => {
    expect(() =>
      RequirePermission('invented.permission' as PermissionKey),
    ).toThrow('Unknown permission key');
    expect(() => RequirePermission()).toThrow('at least one');
  });
  it('ignores unknown database grants', async () => {
    findUnique.mockResolvedValue(
      record(['invented.permission', 'inventory.view']),
    );
    expect(await resolver.resolve(user)).toEqual(new Set(['inventory.view']));
  });
  it.each(['conflict', 'publicConflict'] as const)(
    'rejects mixed policy on %s',
    async (method) => {
      await expect(guard.canActivate(context(method))).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    },
  );
  it('requires authentication', async () => {
    await expect(guard.canActivate(context('waste', null))).rejects.toThrow(
      'Authentication required',
    );
  });
  it('keeps migration seeds aligned with the catalog', () => {
    const root = join(__dirname, '../../../prisma/migrations');
    const sql = readdirSync(root).filter((name) => name !== 'migration_lock.toml')
      .map((name) => readFileSync(join(root, name, 'migration.sql'), 'utf8')).join('\n');
    for (const permission of PERMISSION_CATALOG)
      expect(sql).toContain(`'${permission.key}'`);
    
  });
});
