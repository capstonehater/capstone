/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matchers intentionally return any. */
import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { AccountStatus, Role } from '@prisma/client';
import { firstValueFrom, of } from 'rxjs';
import { AuthController } from './auth.controller';
import { AuthPermissionsInterceptor } from './auth-permissions.interceptor';
import { PermissionResolver } from './rbac/permission-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
const member = (id: string, keys: string[], revision = 1) => ({
  assignedAt: new Date('2026-01-01'),
  role: {
    id,
    key: id,
    name: id,
    description: 'Test role',
    revision,
    permissions: keys.map((key) => ({ permission: { key } })),
  },
});
const record = (...roles: ReturnType<typeof member>[]) => ({
  isActive: true,
  accountStatus: AccountStatus.ACTIVE,
  accessRoles: roles,
});
const publicUser = {
  id: 'user',
  name: 'Test',
  email: 'test@example.invalid',
  role: Role.STAFF,
  profilePictureUrl: null,
};
describe('Auth permission payload', () => {
  const findUnique = jest.fn();
  const resolver = new PermissionResolver({
    user: { findUnique },
  } as unknown as PrismaService);
  const interceptor = new AuthPermissionsInterceptor(resolver);
  beforeEach(() => findUnique.mockReset());
  it('returns one role and its permissions', async () => {
    findUnique.mockResolvedValue(
      record(member('inventory', ['inventory.view'])),
    );
    expect(await resolver.snapshot(publicUser)).toEqual({
      roles: [
        {
          id: 'inventory',
          key: 'inventory',
          name: 'inventory',
          description: 'Test role',
        },
      ],
      effectivePermissions: ['inventory.view'],
      authorizationRevision: expect.any(String),
    });
  });
  it('returns a sorted union from multiple roles and ignores unknown keys', async () => {
    findUnique.mockResolvedValue(
      record(
        member('a', ['inventory.view', 'unknown']),
        member('b', ['pos.view', 'inventory.view']),
      ),
    );
    expect((await resolver.snapshot(publicUser)).effectivePermissions).toEqual([
      'inventory.view',
      'pos.view',
    ]);
  });
  it.each([
    { ...record(member('a', ['inventory.view'])), isActive: false },
    {
      ...record(member('a', ['inventory.view'])),
      accountStatus: AccountStatus.INACTIVE,
    },
    null,
  ])('returns no permissions for inactive/missing users', async (value) => {
    findUnique.mockResolvedValue(value);
    expect((await resolver.snapshot(publicUser)).effectivePermissions).toEqual(
      [],
    );
  });
  it('keeps revisions stable across query ordering and changes them on edits or membership changes', async () => {
    findUnique
      .mockResolvedValueOnce(
        record(member('b', ['pos.view']), member('a', ['inventory.view'])),
      )
      .mockResolvedValueOnce(
        record(member('a', ['inventory.view']), member('b', ['pos.view'])),
      )
      .mockResolvedValueOnce(
        record(member('a', ['inventory.view'], 2), member('b', ['pos.view'])),
      )
      .mockResolvedValueOnce(record(member('a', ['inventory.view'], 2)));
    const first = await resolver.snapshot(publicUser);
    expect((await resolver.snapshot(publicUser)).authorizationRevision).toBe(
      first.authorizationRevision,
    );
    const edited = await resolver.snapshot(publicUser);
    expect(edited.authorizationRevision).not.toBe(first.authorizationRevision);
    expect(
      (await resolver.snapshot(publicUser)).authorizationRevision,
    ).not.toBe(edited.authorizationRevision);
  });
  it.each(['login', 'getMe'] as const)(
    'extends %s without removing the legacy role or changing its envelope',
    async (method) => {
      findUnique.mockResolvedValue(record(member('a', ['inventory.view'])));
      const context = {
        getClass: () => AuthController,
        getHandler: () => AuthController.prototype[method],
      } as unknown as ExecutionContext;
      const output = await firstValueFrom(
        interceptor.intercept(context, {
          handle: () => of({ message: 'ok', user: publicUser }),
        }),
      );
      expect(output).toEqual({
        message: 'ok',
        user: {
          ...publicUser,
          roles: [{ id: 'a', key: 'a', name: 'a', description: 'Test role' }],
          effectivePermissions: ['inventory.view'],
          authorizationRevision: expect.any(String),
        },
      });
    },
  );
  it('does not touch other controllers', async () => {
    class BusinessController {}
    const context = {
      getClass: () => BusinessController,
      getHandler: () => function getMe() {},
    } as unknown as ExecutionContext;
    const response = { user: publicUser };
    expect(
      await firstValueFrom(
        interceptor.intercept(context, { handle: () => of(response) }),
      ),
    ).toBe(response);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
