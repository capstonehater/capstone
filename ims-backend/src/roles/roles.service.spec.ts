/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers are intentionally untyped. */
import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

const baseRole = {
  id: 'role',
  key: 'custom:test',
  name: 'Inventory Manager',
  description: 'Inventory',
  isSystem: false,
  isProtected: false,
  revision: 1,
  _count: { members: 0 },
  permissions: [{ permission: { id: 'p1', key: 'inventory.view' } }],
};
describe('Roles management API service', () => {
  const tx = {
    accessRole: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    permission: { findMany: jest.fn() },
    rolePermission: { deleteMany: jest.fn(), createMany: jest.fn() },
    authorizationAuditEvent: { create: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((action: (client: typeof tx) => unknown) =>
      action(tx),
    ),
  };
  const service = new RolesService(prisma as unknown as PrismaService);
  beforeEach(() => {
    for (const group of Object.values(tx))
      for (const mock of Object.values(group)) mock.mockReset();
    tx.accessRole.findFirst.mockResolvedValue(null);
    tx.accessRole.findUnique.mockResolvedValue(baseRole);
    tx.permission.findMany.mockResolvedValue([
      { id: 'p1', key: 'inventory.view' },
    ]);
    tx.accessRole.create.mockResolvedValue(baseRole);
    tx.accessRole.updateMany.mockResolvedValue({ count: 1 });
    tx.accessRole.findUniqueOrThrow.mockResolvedValue({
      ...baseRole,
      revision: 2,
    });
  });
  it('restricts the entire controller to existing Administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RolesController)).toEqual([
      Role.ADMINISTRATOR,
    ]);
  });
  it('lists member counts and permissions from database rows', async () => {
    tx.accessRole.findMany.mockResolvedValue([baseRole]);
    expect(await service.list()).toEqual([
      expect.objectContaining({
        memberCount: 0,
        permissionKeys: ['inventory.view'],
      }),
    ]);
  });
  it('returns only code-managed catalog permissions', async () => {
    tx.permission.findMany.mockResolvedValue([
      { key: 'inventory.view' },
      { key: 'unknown' },
    ]);
    expect(await service.permissions()).toEqual([{ key: 'inventory.view' }]);
  });
  it('creates a role and audit snapshot atomically', async () => {
    await service.create(
      {
        name: 'Inventory Manager',
        description: 'Inventory',
        permissionKeys: ['inventory.view'],
      },
      'actor',
    );
    expect(tx.accessRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          key: expect.stringMatching(/^custom:/),
          permissions: { create: [{ permissionId: 'p1' }] },
        }),
      }),
    );
    expect(tx.authorizationAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 'actor',
          action: 'role.created',
        }),
      }),
    );
  });
  it('rejects arbitrary permission keys before writes', async () => {
    await expect(
      service.create(
        { name: 'Test', description: '', permissionKeys: ['unknown'] },
        'actor',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.accessRole.create).not.toHaveBeenCalled();
  });
  it('rejects stale saves without replacing grants', async () => {
    tx.accessRole.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update(
        'role',
        {
          name: 'Test',
          description: '',
          permissionKeys: ['inventory.view'],
          revision: 1,
        },
        'actor',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.rolePermission.deleteMany).not.toHaveBeenCalled();
  });
  it('updates permission grants and writes an audit snapshot', async () => {
    expect(
      await service.update(
        'role',
        {
          name: 'Test',
          description: '',
          permissionKeys: ['inventory.view'],
          revision: 1,
        },
        'actor',
      ),
    ).toEqual(expect.objectContaining({ revision: 2 }));
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: 'role', permissionId: 'p1' }],
    });
    expect(tx.authorizationAuditEvent.create).toHaveBeenCalled();
  });
  it('rejects removal of all Administrator permissions', async () => {
    tx.accessRole.findUnique.mockResolvedValue({
      ...baseRole,
      key: 'ADMINISTRATOR',
      isProtected: true,
    });
    await expect(
      service.update(
        'role',
        {
          name: 'Administrator',
          description: '',
          permissionKeys: [],
          revision: 1,
        },
        'actor',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it.each([{ isProtected: true }, { isSystem: true }])(
    'rejects protected/system deletion',
    async (flags) => {
      tx.accessRole.findUnique.mockResolvedValue({ ...baseRole, ...flags });
      await expect(service.remove('role', 1, 'actor')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.accessRole.delete).not.toHaveBeenCalled();
    },
  );
  it('rejects deletion of assigned roles', async () => {
    tx.accessRole.findUnique.mockResolvedValue({
      ...baseRole,
      _count: { members: 1 },
    });
    await expect(service.remove('role', 1, 'actor')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
  it('deletes an unassigned custom role and preserves an audit snapshot', async () => {
    await expect(service.remove('role', 1, 'actor')).resolves.toEqual({
      deleted: true,
    });
    expect(tx.accessRole.delete).toHaveBeenCalledWith({
      where: { id: 'role', revision: 1 },
    });
    expect(tx.authorizationAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'role.deleted',
          targetRoleId: 'role',
          beforeState: expect.any(Object),
        }),
      }),
    );
  });
});
