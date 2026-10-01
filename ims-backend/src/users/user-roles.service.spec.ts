import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma, Role } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { UserRolesService } from './user-roles.service';
import { UserRolesController } from './user-roles.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
const actor: AuthenticatedUser = {
  id: 'actor',
  role: Role.ADMINISTRATOR,
  email: 'test@example.invalid',
  name: 'Admin',
  isActive: true,
  sessionId: 'session',
};
const active = { accountStatus: AccountStatus.ACTIVE, isActive: true };
const role = {
  id: 'custom',
  key: 'custom:inventory',
  name: 'Inventory Manager',
  isSystem: false,
  isProtected: false,
};

describe('User role assignments', () => {
  const tx = {
    user: { findUnique: jest.fn(), count: jest.fn(), update: jest.fn() },
    accessRole: { findMany: jest.fn() },
    userRole: {
      count: jest.fn(),
      findUnique: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
    },
    authSession: { updateMany: jest.fn() },
    authorizationAuditEvent: { create: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((action: (client: typeof tx) => unknown) =>
      action(tx),
    ),
  };
  const service = new UserRolesService(prisma as unknown as PrismaService);
  beforeEach(() => {
    for (const group of Object.values(tx))
      for (const mock of Object.values(group)) mock.mockReset();
    tx.user.findUnique.mockImplementation(
      ({ where }: { where: { id: string } }) =>
        Promise.resolve({
          id: where.id,
          role: where.id === 'actor' ? Role.ADMINISTRATOR : Role.STAFF,
          ...active,
        }),
    );
    tx.accessRole.findMany.mockResolvedValue([role]);
    tx.userRole.count.mockResolvedValue(0);
    tx.userRole.findUnique.mockResolvedValue({ role });
    tx.user.count.mockResolvedValue(1);
  });
  it('assigns a role, records actor and revokes sessions without overwriting legacy role', async () => {
    await expect(
      service.assign('target', { roleId: 'custom' }, actor),
    ).resolves.toEqual({ assignedRoleIds: ['custom'] });
    expect(tx.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'target', roleId: 'custom', assignedByUserId: 'actor' }],
    });
    expect(tx.authSession.updateMany).toHaveBeenCalled();
    expect(tx.authorizationAuditEvent.create).toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('assigns multiple selected roles in one transaction', async () => {
    tx.accessRole.findMany.mockResolvedValue([role, { ...role, id: 'second' }]);
    await service.assign('target', { roleIds: ['custom', 'second'] }, actor);
    expect(tx.userRole.createMany).toHaveBeenCalledTimes(1);
    expect(tx.userRole.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'target', roleId: 'custom', assignedByUserId: 'actor' },
        { userId: 'target', roleId: 'second', assignedByUserId: 'actor' },
      ],
    });
  });
  it('removes a custom membership without deleting the role or changing the scalar', async () => {
    await expect(service.remove('target', 'custom', actor)).resolves.toEqual({
      removed: true,
    });
    expect(tx.userRole.delete).toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.authSession.updateMany).toHaveBeenCalled();
  });
  it('rejects removal of the last active Administrator membership', async () => {
    tx.userRole.findUnique.mockResolvedValue({
      role: {
        ...role,
        key: 'ADMINISTRATOR',
        isSystem: true,
        isProtected: true,
      },
    });
    tx.user.count.mockResolvedValue(0);
    await expect(service.remove('target', 'admin', actor)).rejects.toThrow(
      'At least one active Administrator',
    );
    expect(tx.userRole.delete).not.toHaveBeenCalled();
  });
  it('allows removal of an extra Administrator membership when another active member remains', async () => {
    tx.userRole.findUnique.mockResolvedValue({
      role: {
        ...role,
        key: 'ADMINISTRATOR',
        isSystem: true,
        isProtected: true,
      },
    });
    await expect(service.remove('target', 'admin', actor)).resolves.toEqual({
      removed: true,
    });
  });
  it('keeps the protected compatibility membership linked to User.role', async () => {
    tx.userRole.findUnique.mockResolvedValue({
      role: { ...role, key: 'STAFF', isSystem: true, isProtected: true },
    });
    await expect(service.remove('target', 'staff', actor)).rejects.toThrow(
      'legacy role',
    );
    expect(tx.userRole.delete).not.toHaveBeenCalled();
  });
  it('rejects duplicate existing assignments', async () => {
    tx.userRole.count.mockResolvedValue(1);
    await expect(
      service.assign('target', { roleId: 'custom' }, actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userRole.createMany).not.toHaveBeenCalled();
  });
  it('rejects duplicate IDs and ambiguous bodies', () => {
    expect(() =>
      service.assign('target', { roleIds: ['custom', 'custom'] }, actor),
    ).toThrow(BadRequestException);
    expect(() =>
      service.assign(
        'target',
        { roleId: 'custom', roleIds: ['custom'] },
        actor,
      ),
    ).toThrow(BadRequestException);
  });
  it('rejects missing roles before any write', async () => {
    tx.accessRole.findMany.mockResolvedValue([]);
    await expect(
      service.assign('target', { roleId: 'missing' }, actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.userRole.createMany).not.toHaveBeenCalled();
  });
  it('rejects self escalation by a non-Administrator', async () => {
    await expect(
      service.assign(
        'actor',
        { roleId: 'custom' },
        { ...actor, role: Role.STAFF },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('permits self assignment for an existing active legacy Administrator', async () => {
    await expect(
      service.assign('actor', { roleId: 'custom' }, actor),
    ).resolves.toEqual({ assignedRoleIds: ['custom'] });
  });
  it('rejects an actor whose account has become inactive', async () => {
    tx.user.findUnique.mockResolvedValue({
      ...actor,
      accountStatus: AccountStatus.INACTIVE,
    });
    await expect(
      service.assign('target', { roleId: 'custom' }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('returns configured membership and union permissions', async () => {
    const member = (key: string) => ({
      role: { ...role, permissions: [{ permission: { key } }] },
    });
    tx.user.findUnique.mockResolvedValue({
      id: 'target',
      role: Role.STAFF,
      ...active,
      accessRoles: [
        member('inventory.view'),
        member('inventory.waste'),
        member('inventory.view'),
      ],
    });
    expect((await service.list('target')).effectivePermissions).toEqual([
      'inventory.view',
      'inventory.waste',
    ]);
  });
  it('keeps legacy Administrator route checks authoritative', () => {
    expect(Reflect.getMetadata(ROLES_KEY, UserRolesController)).toEqual([
      Role.ADMINISTRATOR,
    ]);
    const context = (user: AuthenticatedUser) =>
      ({
        // Method reference is metadata only; it is never invoked unbound.
        // eslint-disable-next-line @typescript-eslint/unbound-method
        getHandler: () => UserRolesController.prototype.assign,
        getClass: () => UserRolesController,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }) as unknown as ExecutionContext;
    const guard = new RolesGuard(new Reflector());
    expect(guard.canActivate(context(actor))).toBe(true);
    expect(() =>
      guard.canActivate(context({ ...actor, role: Role.STAFF })),
    ).toThrow(ForbiddenException);
  });
  it('protects the last effective Administrator in existing account safeguards', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: 'target',
      role: Role.STAFF,
      ...active,
      accessRoles: [{ roleId: 'admin' }],
    });
    tx.user.count.mockResolvedValue(0);
    const users = new UsersService(prisma as unknown as PrismaService);
    await expect(
      users['assertNotLastActiveAdministrator'](
        tx as unknown as Prisma.TransactionClient,
        'target',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('preserves the original last legacy Administrator check', async () => {
    tx.user.findUnique.mockResolvedValue({
      id: 'target',
      role: Role.ADMINISTRATOR,
      ...active,
      accessRoles: [{ roleId: 'admin' }],
    });
    tx.user.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const users = new UsersService(prisma as unknown as PrismaService);
    await expect(
      users['assertNotLastActiveAdministrator'](
        tx as unknown as Prisma.TransactionClient,
        'target',
      ),
    ).rejects.toThrow('active administrator must remain');
  });
});
