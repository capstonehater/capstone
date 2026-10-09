import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AccountStatus, Role } from '@prisma/client';
import type { Server } from 'node:http';
import request from 'supertest';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PasswordService } from '../auth/password.service';
import { SessionService } from '../auth/session.service';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionResolver } from '../auth/rbac/permission-resolver.service';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRED_PERMISSIONS_KEY } from '../auth/decorators/require-permission.decorator';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ForecastingController } from '../forecasting/forecasting.controller';
import { ForecastingService } from '../forecasting/forecasting.service';

jest.mock('../config/env.validation', () => ({
  env: { SESSION_COOKIE_NAME: 'test_session' },
}));
const routes = [
  { method: 'get', path: '/settings/account', body: {} },
  {
    method: 'patch',
    path: '/settings/account',
    body: { firstName: 'Updated' },
  },
  {
    method: 'post',
    path: '/settings/change-password',
    body: { currentPassword: 'Current1234', newPassword: 'Changed123!' },
  },
] as const;
describe('Settings self-service authorization and account protections', () => {
  let app: INestApplication;
  let role: Role;
  const account = {
    id: 'self',
    firstName: 'Test',
    middleInitial: null,
    lastName: 'User',
    email: 'test@example.invalid',
    phone: '1234567',
    profilePictureUrl: null,
    role: Role.STAFF,
    accountStatus: AccountStatus.ACTIVE,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: 'old-hash',
  };
  const user = { findUnique: jest.fn(), update: jest.fn() };
  const authSession = { updateMany: jest.fn() };
  const tx = { user, authSession };
  const prisma = {
    ...tx,
    $transaction: jest.fn((action: unknown) =>
      typeof action === 'function'
        ? (action as (client: typeof tx) => unknown)(tx)
        : Promise.all(action as Promise<unknown>[]),
    ),
  };
  const passwords = {
    verifyPassword: jest.fn(),
    hashPassword: jest.fn(),
    simulatePasswordCheck: jest.fn(),
  };
  const validateSession = jest.fn();
  const resolve = jest.fn();
  const send = (
    route: {
      method: 'get' | 'patch' | 'post' | 'put';
      path: string;
      body?: object;
    },
    session = true,
  ) => {
    const call = request(app.getHttpServer() as Server)[route.method](
      route.path,
    );
    if (session) call.set('Cookie', 'test_session=valid');
    return call.send(route.body ?? {});
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SettingsController, ForecastingController],
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PasswordService, useValue: passwords },
        { provide: SessionService, useValue: { validateSession } },
        { provide: PermissionResolver, useValue: { resolve } },
        { provide: ForecastingService, useValue: {} },
        { provide: APP_GUARD, useClass: SessionAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    role = Role.STAFF;
    validateSession.mockImplementation(() =>
      Promise.resolve({
        id: 'self',
        role,
        isActive: true,
        sessionId: 'session',
        email: account.email,
      }),
    );
    user.findUnique.mockResolvedValue(account);
    user.update.mockResolvedValue(account);
    authSession.updateMany.mockResolvedValue({ count: 2 });
    passwords.verifyPassword.mockResolvedValue(true);
    passwords.hashPassword.mockResolvedValue('new-hash');
    resolve.mockResolvedValue({ permissions: [] });
  });
  it.each([Role.STAFF, Role.MANAGER, Role.ADMINISTRATOR])(
    'allows %s self-service without permission grants',
    async (value) => {
      role = value;
      for (const route of routes)
        await send(route).expect(route.method === 'post' ? 201 : 200);
      expect(resolve).not.toHaveBeenCalled();
      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'self' } }),
      );
    },
  );
  it.each(routes)('requires a session for $method $path', async (route) => {
    await send(route, false).expect(401);
    expect(user.findUnique).not.toHaveBeenCalled();
  });
  it.each(routes)(
    'rejects invalid/revoked sessions for $method $path',
    async (route) => {
      validateSession.mockResolvedValueOnce(null);
      await send(route).expect(401);
      expect(user.findUnique).not.toHaveBeenCalled();
    },
  );
  it.each(['id', 'userId', 'role', 'accountStatus', 'isActive', 'permissions'])(
    'rejects protected or target field %s',
    async (key) => {
      await send({
        method: 'patch',
        path: '/settings/account',
        body: { firstName: 'Updated', [key]: 'other' },
      }).expect(400);
      expect(user.update).not.toHaveBeenCalled();
    },
  );
  it('cannot target another account by URL', async () => {
    await send({
      method: 'patch',
      path: '/settings/account/other',
      body: { firstName: 'Updated' },
    }).expect(404);
    expect(user.update).not.toHaveBeenCalled();
  });
  it('ignores query targeting and updates only the authenticated account', async () => {
    await send({
      method: 'patch',
      path: '/settings/account?userId=other',
      body: { firstName: 'Updated' },
    }).expect(200);
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'self' },
        data: { firstName: 'Updated' },
      }),
    );
    expect(authSession.updateMany).not.toHaveBeenCalled();
  });
  it.each(['short', 'alllowercase123', 'ALLUPPERCASE123', 'NoNumbersHere'])(
    'rejects weak password %s',
    async (newPassword) => {
      await send({
        ...routes[2],
        body: { currentPassword: 'Current1234', newPassword },
      }).expect(400);
      expect(user.update).not.toHaveBeenCalled();
    },
  );
  it('rejects incorrect current password before writes', async () => {
    passwords.verifyPassword.mockResolvedValueOnce(false);
    await send(routes[2]).expect(401);
    expect(user.update).not.toHaveBeenCalled();
    expect(authSession.updateMany).not.toHaveBeenCalled();
  });
  it('password change hashes and revokes only own sessions and clears cookie', async () => {
    const response = await send(routes[2]).expect(201);
    expect(passwords.hashPassword).toHaveBeenCalledWith('Changed123!');
    expect(user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'self' },
        data: expect.objectContaining({ passwordHash: 'new-hash' }) as unknown,
      }),
    );
    expect(authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'self', revokedAt: null },
        data: expect.objectContaining({
          revokeReason: 'password_changed',
        }) as unknown,
      }),
    );
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('test_session=;')]),
    );
  });
  it('email change revokes own sessions and clears cookie', async () => {
    const response = await send({
      method: 'patch',
      path: '/settings/account',
      body: { email: 'new@example.invalid' },
    }).expect(200);
    expect(response.body).toMatchObject({ requiresReauthentication: true });
    expect(authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'self', revokedAt: null },
        data: expect.objectContaining({
          revokeReason: 'self_login_identifier_changed',
        }) as unknown,
      }),
    );
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('test_session=;')]),
    );
  });
  it('self-service has no role/permission/public overrides', () => {
    const reflector = new Reflector();
    const prototype = SettingsController.prototype as unknown as Record<
      string,
      (...args: never[]) => unknown
    >;
    for (const target of [
      SettingsController,
      prototype.getAccount,
      prototype.updateAccount,
      prototype.changePassword,
    ]) {
      for (const key of [ROLES_KEY, REQUIRED_PERMISSIONS_KEY, IS_PUBLIC_KEY])
        expect(reflector.get(key, target)).toBeUndefined();
    }
  });
});
