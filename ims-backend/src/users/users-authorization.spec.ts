import 'reflect-metadata';
import { AuthService } from '../auth/auth.service';
import { UserRolesController } from './user-roles.controller';
import { UserRolesService } from './user-roles.service';
import { RolesController } from '../roles/roles.controller';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionResolver } from '../auth/rbac/permission-resolver.service';
import {
  PERMISSION_CATALOG,
  type PermissionKey,
} from '../auth/rbac/permission-catalog';
import { SessionService } from '../auth/session.service';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

// No real sessions, environment secrets, database, or business mutations in this suite.
jest.mock('../config/env.validation', () => ({
  env: { SESSION_COOKIE_NAME: 'test_session' },
}));
const routes = [
  {
    controller: UsersController,
    handler: 'listUsers',
    method: 'get',
    path: '/users',
    permission: 'users.view',
  },
  {
    controller: UsersController,
    handler: 'getUser',
    method: 'get',
    path: '/users/target',
    permission: 'users.view',
  },
  {
    controller: UsersController,
    handler: 'listUserActivity',
    method: 'get',
    path: '/users/target/activity',
    permission: 'users.view',
  },
  {
    controller: UsersController,
    handler: 'listUserSessions',
    method: 'get',
    path: '/users/target/sessions',
    permission: 'users.view',
  },
  {
    controller: UsersController,
    handler: 'createUser',
    method: 'post',
    path: '/users',
    permission: 'users.manage',
  },
  {
    controller: UsersController,
    handler: 'updateUser',
    method: 'patch',
    path: '/users/target',
    permission: 'users.manage',
  },
  {
    controller: UsersController,
    handler: 'suspendUser',
    method: 'post',
    path: '/users/target/suspend',
    permission: 'users.manage',
  },
  {
    controller: UsersController,
    handler: 'reactivateUser',
    method: 'post',
    path: '/users/target/reactivate',
    permission: 'users.manage',
  },
  {
    controller: UsersController,
    handler: 'requestUserPasswordReset',
    method: 'post',
    path: '/users/target/password-reset',
    permission: 'users.manage',
  },
  {
    controller: UsersController,
    handler: 'deleteUser',
    method: 'delete',
    path: '/users/target',
    permission: 'users.manage',
  },
  {
    controller: UsersController,
    handler: 'revokeUserSession',
    method: 'delete',
    path: '/users/target/sessions/session',
    permission: 'users.sessions.revoke',
  },
  {
    controller: UsersController,
    handler: 'revokeAllUserSessions',
    method: 'post',
    path: '/users/target/sessions/revoke-all',
    permission: 'users.sessions.revoke',
  },
] as const;
const serviceMethods = [
  'listUsers',
  'getUserDetail',
  'listUserActivity',
  'listUserSessions',
  'createUser',
  'updateUser',
  'suspendUser',
  'reactivateUser',
  'deleteUser',
  'revokeUserSession',
  'revokeAllUserSessions',
];
describe('User endpoint authorization (real HTTP guards and resolver)', () => {
  let app: INestApplication;
  let principal: AuthenticatedUser;
  let grants: string[];
  const issuePasswordResetForUserId = jest.fn().mockResolvedValue({});
  const roleService = { list: jest.fn(), assign: jest.fn(), remove: jest.fn() };
  const findUnique = jest.fn();
  const validateSession = jest.fn();
  const userService = Object.fromEntries(
    serviceMethods.map((name) => [
      name,
      jest.fn().mockResolvedValue({ ok: true }),
    ]),
  );
  const allCalls = () =>
    Object.values(userService).reduce(
      (sum, fn) => sum + fn.mock.calls.length,
      0,
    );
  const send = (
    route: {
      method: 'get' | 'post' | 'put' | 'patch' | 'delete';
      path: string;
    },
    authenticated = true,
  ) => {
    const call = request(app.getHttpServer() as Server)[route.method](
      route.path,
    );
    if (authenticated) call.set('Cookie', 'test_session=valid');
    return call.send(
      route.path === '/users' && route.method === 'post'
        ? { role: 'STAFF' }
        : {},
    );
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [UsersController, UserRolesController],
      providers: [
        { provide: UsersService, useValue: userService },
        { provide: AuthService, useValue: { issuePasswordResetForUserId } },
        { provide: UserRolesService, useValue: roleService },
        { provide: PrismaService, useValue: { user: { findUnique } } },
        { provide: SessionService, useValue: { validateSession } },
        PermissionResolver,
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    principal = {
      id: 'user-1',
      email: 'test@example.invalid',
      name: 'Test',
      role: Role.STAFF,
      isActive: true,
      sessionId: 'session-1',
    };
    grants = [];
    validateSession.mockImplementation((token: string) =>
      Promise.resolve(token === 'valid' ? principal : null),
    );
    findUnique.mockImplementation(() =>
      Promise.resolve({
        isActive: true,
        accountStatus: AccountStatus.ACTIVE,
        accessRoles: [
          {
            assignedAt: new Date('2026-01-01'),
            role: {
              id: 'custom-role',
              key: 'custom',
              name: 'Custom role',
              description: '',
              revision: 1,
              permissions: grants.map((key) => ({ permission: { key } })),
            },
          },
        ],
      }),
    );
  });

  it.each(routes)(
    '$method $path has its exact permission without conflicting roles',
    (route) => {
      const reflector = new Reflector();
      const prototype = UsersController.prototype as unknown as Record<
        string,
        (...args: never[]) => unknown
      >;
      expect(
        reflector.getAllAndOverride(REQUIRED_PERMISSIONS_KEY, [
          prototype[route.handler],
          UsersController,
        ]),
      ).toEqual([route.permission]);
      for (const target of [prototype[route.handler], UsersController]) {
        expect(reflector.get(ROLES_KEY, target)).toBeUndefined();
        expect(reflector.get(IS_PUBLIC_KEY, target)).toBeUndefined();
      }
    },
  );
  it('accounts for all user handlers', () => {
    expect(
      Object.getOwnPropertyNames(UsersController.prototype)
        .filter((name) => name !== 'constructor')
        .sort(),
    ).toEqual(routes.map((route) => route.handler).sort());
  });
  it.each(routes)(
    'Administrator with grants can call $method $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      grants = [route.permission];
      await send(route).expect(route.method === 'post' ? 201 : 200);
    },
  );
  it.each(routes)(
    'no grants deny $method $path before services',
    async (route) => {
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
      expect(issuePasswordResetForUserId).not.toHaveBeenCalled();
    },
  );
  it.each(routes)('no session denies $method $path', async (route) => {
    grants = [route.permission];
    await send(route, false).expect(401);
    expect(findUnique).not.toHaveBeenCalled();
    expect(allCalls()).toBe(0);
  });
  it.each(routes)(
    'legacy Administrator without grants is denied on $method $path',
    async (route) => {
      principal.role = Role.ADMINISTRATOR;
      await send(route).expect(403);
      expect(allCalls()).toBe(0);
    },
  );
  it.each([
    'users.view',
    'users.manage',
    'users.sessions.revoke',
  ] as PermissionKey[])(
    'isolates %s from other user capabilities',
    async (permission) => {
      principal.role = Role.ADMINISTRATOR;
      grants = [permission];
      for (const route of routes)
        await send(route).expect(
          route.permission === permission
            ? route.method === 'post'
              ? 201
              : 200
            : 403,
        );
    },
  );
  it.each(['/users/target/roles', '/users/target/roles/role'])(
    'user grants do not bypass separate role assignment boundary at %s',
    async (path) => {
      grants = ['users.view', 'users.manage', 'users.sessions.revoke'];
      const method = path.endsWith('/role') ? 'delete' : 'post';
      await send({ path, method }).expect(403);
      expect(roleService.assign).not.toHaveBeenCalled();
      expect(roleService.remove).not.toHaveBeenCalled();
    },
  );
  it('keeps role administration class policies unchanged', () => {
    const reflector = new Reflector();
    for (const controller of [UserRolesController, RolesController]) {
      expect(reflector.get(ROLES_KEY, controller)).toEqual([
        Role.ADMINISTRATOR,
      ]);
      expect(
        reflector.get(REQUIRED_PERMISSIONS_KEY, controller),
      ).toBeUndefined();
    }
  });
  it('allows legacy Administrator role reads separately without user grants', async () => {
    principal.role = Role.ADMINISTRATOR;
    await send({ method: 'get', path: '/users/target/roles' }).expect(200);
    expect(roleService.list).toHaveBeenCalledWith('target');
  });
  it('revocation denies the next user read', async () => {
    grants = ['users.view'];
    await send(routes[0]).expect(200);
    grants = [];
    await send(routes[0]).expect(403);
    expect(allCalls()).toBe(1);
  });
  it('uses only the existing user catalog keys', () => {
    expect(
      [...new Set(routes.map((route) => route.permission))].sort(),
    ).toEqual(
      PERMISSION_CATALOG.filter((item) => item.module === 'users')
        .map((item) => item.key)
        .sort(),
    );
  });
  it.each(routes)(
    'custom user administrator with exact grant can call $method $path',
    async (route) => {
      grants = [route.permission];
      await send(route).expect(route.method === 'post' ? 201 : 200);
    },
  );
  it('rejects privileged account creation by a non-Administrator', async () => {
    grants = ['users.manage'];
    await request(app.getHttpServer() as Server)
      .post('/users')
      .set('Cookie', 'test_session=valid')
      .send({ role: 'ADMINISTRATOR' })
      .expect(403);
    expect(userService.createUser).not.toHaveBeenCalled();
    expect(issuePasswordResetForUserId).not.toHaveBeenCalled();
  });
  it.each(['ADMINISTRATOR', 'STAFF'])(
    'rejects legacy role assignment to %s by non-Administrators',
    async (role) => {
      grants = ['users.manage'];
      await request(app.getHttpServer() as Server)
        .patch('/users/target')
        .set('Cookie', 'test_session=valid')
        .send({ role })
        .expect(403);
      expect(userService.updateUser).not.toHaveBeenCalled();
    },
  );
  it('preserves legacy Administrator role editing with users.manage', async () => {
    principal.role = Role.ADMINISTRATOR;
    grants = ['users.manage'];
    await request(app.getHttpServer() as Server)
      .patch('/users/target')
      .set('Cookie', 'test_session=valid')
      .send({ role: 'STAFF' })
      .expect(200);
    expect(userService.updateUser).toHaveBeenCalledWith(
      'target',
      { role: 'STAFF' },
      principal,
    );
  });
});
