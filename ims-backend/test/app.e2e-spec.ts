/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { csrfOriginMiddleware } from '../src/auth/csrf-origin.middleware';
import { env } from '../src/config/env.validation';
import { PrismaService } from '../src/prisma/prisma.service';

function buildUser(
  overrides: Partial<{
    id: string;
    email: string;
    username: string | null;
    passwordHash: string | null;
    firstName: string;
    middleInitial: string | null;
    lastName: string;
    phone: string | null;
    role: 'ADMINISTRATOR' | 'MANAGER' | 'STAFF';
    accountStatus: 'PENDING' | 'ACTIVE' | 'INACTIVE';
    isActive: boolean;
    emailVerifiedAt: Date | null;
    passwordChangedAt: Date;
    lastLoginAt: Date | null;
    failedLoginAttempts: number;
    lockedUntil: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'admin@stockscout.com',
    username: 'admin',
    passwordHash: null,
    firstName: 'Admin',
    middleInitial: null,
    lastName: 'User',
    phone: '+639171234567',
    role: 'ADMINISTRATOR' as const,
    accountStatus: 'ACTIVE' as const,
    isActive: true,
    emailVerifiedAt: null,
    passwordChangedAt: new Date('2026-01-01T00:00:00.000Z'),
    lastLoginAt: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildSession(
  userOverrides: Parameters<typeof buildUser>[0] = {},
  sessionOverrides: Partial<{
    id: string;
    userId: string;
    sessionTokenHash: string;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    idleExpiresAt: Date;
    revokedAt: Date | null;
    revokeReason: string | null;
    ipAddress: string | null;
    userAgent: string | null;
  }> = {},
) {
  const user = buildUser(userOverrides);

  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    userId: user.id,
    sessionTokenHash: 'hashed-session-token',
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    lastSeenAt: new Date('2026-02-01T00:00:00.000Z'),
    expiresAt: new Date('2099-02-01T00:00:00.000Z'),
    idleExpiresAt: new Date('2099-02-01T00:00:00.000Z'),
    revokedAt: null,
    revokeReason: null,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    user,
    ...sessionOverrides,
  };
}

describe('User management and auth foundation (e2e)', () => {
  let app: INestApplication<App>;
  const validPassword = 'ValidPass123';
  const passwordHash = bcrypt.hashSync(validPassword, 12);

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    authSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    passwordResetToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    emailVerificationToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    stockRun: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    inventoryTransaction: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    orderReversal: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    alert: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prismaMock.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        return input(prismaMock);
      }

      return Promise.all(input as Promise<unknown>[]);
    });

    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.user.findMany.mockResolvedValue([]);
    prismaMock.authSession.update.mockResolvedValue(undefined);
    prismaMock.authSession.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.authSession.findMany.mockResolvedValue([]);
    prismaMock.authSession.findFirst.mockResolvedValue(null);
    prismaMock.authSession.count.mockResolvedValue(0);
    prismaMock.authSession.aggregate.mockResolvedValue({
      _max: { lastSeenAt: null },
    });
    prismaMock.authSession.groupBy.mockResolvedValue([]);
    prismaMock.passwordResetToken.update.mockResolvedValue(undefined);
    prismaMock.passwordResetToken.updateMany.mockResolvedValue(undefined);
    prismaMock.passwordResetToken.create.mockResolvedValue(undefined);
    prismaMock.order.count.mockResolvedValue(0);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.stockRun.count.mockResolvedValue(0);
    prismaMock.stockRun.findMany.mockResolvedValue([]);
    prismaMock.inventoryTransaction.count.mockResolvedValue(0);
    prismaMock.inventoryTransaction.findMany.mockResolvedValue([]);
    prismaMock.orderReversal.count.mockResolvedValue(0);
    prismaMock.orderReversal.findMany.mockResolvedValue([]);
    prismaMock.product.count.mockResolvedValue(0);
    prismaMock.product.findMany.mockResolvedValue([]);
    prismaMock.alert.count.mockResolvedValue(0);
    prismaMock.alert.findMany.mockResolvedValue([]);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableCors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    });
    app.use(csrfOriginMiddleware);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('rejects unauthenticated /auth/me requests', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('blocks unsafe cross-origin requests before authentication', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'https://evil.example')
      .send({
        email: 'admin@stockscout.com',
        password: validPassword,
      })
      .expect(403);

    expect(response.body).toEqual({
      message: 'Cross-site request blocked',
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('allows unsafe requests from the configured frontend origin', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        passwordHash,
      }),
    );
    prismaMock.user.update.mockResolvedValue(undefined);
    prismaMock.authSession.create.mockResolvedValue({
      id: 'session-origin-allowed',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({
        email: 'admin@stockscout.com',
        password: validPassword,
      })
      .expect(201);
  });

  it('allows unsafe requests with a matching referer when origin is absent', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        passwordHash,
      }),
    );
    prismaMock.user.update.mockResolvedValue(undefined);
    prismaMock.authSession.create.mockResolvedValue({
      id: 'session-referer-allowed',
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Referer', `${env.FRONTEND_ORIGIN}/login`)
      .send({
        email: 'admin@stockscout.com',
        password: validPassword,
      })
      .expect(201);
  });

  it('blocks unsafe requests with a mismatched referer when origin is absent', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Referer', 'https://evil.example/login')
      .send({
        email: 'admin@stockscout.com',
        password: validPassword,
      })
      .expect(403);

    expect(response.body).toEqual({
      message: 'Cross-site request blocked',
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('blocks unsafe requests with a malformed referer when origin is absent', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Referer', 'not a url')
      .send({
        email: 'admin@stockscout.com',
        password: validPassword,
      })
      .expect(403);

    expect(response.body).toEqual({
      message: 'Cross-site request blocked',
    });
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('creates a cookie-backed session on login for an active user', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        passwordHash,
      }),
    );
    prismaMock.user.update.mockResolvedValue(undefined);
    prismaMock.authSession.create.mockResolvedValue({
      id: 'session-1',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@stockscout.com',
        password: validPassword,
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Login successful',
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'admin@stockscout.com',
        name: 'Admin User',
        role: 'ADMINISTRATOR',
      },
    });
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('rejects login for pending users', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        passwordHash: null,
        accountStatus: 'PENDING',
        isActive: false,
      }),
    );

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@stockscout.com',
        password: validPassword,
      })
      .expect(401);
  });

  it('returns a generic forgot-password response for unknown users', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const response = await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({
        email: 'missing@stockscout.com',
      })
      .expect(201);

    expect(response.body).toEqual({
      message:
        'If an account exists for that email, a password reset link will be sent.',
    });
    expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('promotes pending users to ACTIVE when they complete account setup', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-1',
      userId: '11111111-1111-4111-8111-111111111111',
      tokenHash: 'hashed-reset-token',
      requestedAt: new Date('2026-03-01T00:00:00.000Z'),
      expiresAt: new Date('2099-03-01T00:00:00.000Z'),
      usedAt: null,
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        accountStatus: 'PENDING',
      },
    });
    prismaMock.user.update.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: 'a'.repeat(48),
        newPassword: 'NewStrong123',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Password reset successful',
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountStatus: 'ACTIVE',
          isActive: true,
        }),
      }),
    );
  });

  it('keeps inactive users inactive when they reset their password', async () => {
    prismaMock.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-2',
      userId: '22222222-2222-4222-8222-222222222222',
      tokenHash: 'hashed-reset-token',
      requestedAt: new Date('2026-03-01T00:00:00.000Z'),
      expiresAt: new Date('2099-03-01T00:00:00.000Z'),
      usedAt: null,
      user: {
        id: '22222222-2222-4222-8222-222222222222',
        accountStatus: 'INACTIVE',
      },
    });
    prismaMock.user.update.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        token: 'b'.repeat(48),
        newPassword: 'NewStrong123',
      })
      .expect(201);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountStatus: 'INACTIVE',
          isActive: false,
        }),
      }),
    );
  });

  it('blocks staff from administrator-only user routes', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(
      buildSession({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'staff@stockscout.com',
        role: 'STAFF',
      }),
    );

    await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(403);
  });

  it('blocks manager accounts from administrator-only routes', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(
      buildSession({
        id: '44444444-4444-4444-8444-444444444444',
        email: 'manager@stockscout.com',
        role: 'MANAGER',
      }),
    );

    await request(app.getHttpServer())
      .get('/users')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(403);
  });

  it('blocks manager accounts from staff routes by fallback', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(
      buildSession({
        id: '44444444-4444-4444-8444-444444444444',
        email: 'manager@stockscout.com',
        role: 'MANAGER',
      }),
    );

    await request(app.getHttpServer())
      .get('/orders')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(403);
  });

  it('allows administrators to read their own settings account safely', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        middleInitial: 'Q',
        lastLoginAt: new Date('2026-02-02T00:00:00.000Z'),
      }),
    );

    const response = await request(app.getHttpServer())
      .get('/settings/account')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: '11111111-1111-4111-8111-111111111111',
        firstName: 'Admin',
        middleInitial: 'Q',
        lastName: 'User',
        name: 'Admin Q. User',
        email: 'admin@stockscout.com',
        phone: '+639171234567',
        role: 'ADMINISTRATOR',
        status: 'ACTIVE',
        lastLoginAt: '2026-02-02T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(response.body.user.isActive).toBeUndefined();
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.body.user.failedLoginAttempts).toBeUndefined();
    expect(response.body.user.lockedUntil).toBeUndefined();
  });

  it('blocks staff from administrator settings endpoints', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(
      buildSession({
        id: '33333333-3333-4333-8333-333333333333',
        email: 'staff@stockscout.com',
        role: 'STAFF',
      }),
    );

    await request(app.getHttpServer())
      .get('/settings/account')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(403);
  });

  it('blocks manager accounts from administrator settings endpoints', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(
      buildSession({
        id: '44444444-4444-4444-8444-444444444444',
        email: 'manager@stockscout.com',
        role: 'MANAGER',
      }),
    );

    await request(app.getHttpServer())
      .get('/settings/account')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(403);
  });

  it('updates harmless settings profile fields without revoking sessions', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@stockscout.com',
    });
    prismaMock.user.update.mockResolvedValue(
      buildUser({
        firstName: 'Updated',
        middleInitial: 'R',
        phone: '+639179999999',
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/settings/account')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({
        firstName: ' Updated ',
        middleInitial: 'r',
        phone: '+639179999999',
      })
      .expect(200);

    expect(response.body).toEqual({
      message: 'Account updated successfully',
      user: expect.objectContaining({
        firstName: 'Updated',
        middleInitial: 'R',
        phone: '+639179999999',
        email: 'admin@stockscout.com',
        role: 'ADMINISTRATOR',
        status: 'ACTIVE',
      }),
      requiresReauthentication: false,
    });
    expect(prismaMock.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('rejects mass-assignment fields on settings account update', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());

    await request(app.getHttpServer())
      .patch('/settings/account')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({
        role: 'STAFF',
        accountStatus: 'INACTIVE',
        isActive: false,
        id: 'other-id',
        employeeId: 'EMP-1',
        branch: 'Main',
        passwordHash: 'hash',
        failedLoginAttempts: 99,
      })
      .expect(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('revokes sessions and clears the cookie when settings email changes', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@stockscout.com',
    });
    prismaMock.user.update.mockResolvedValue(
      buildUser({
        email: 'new-admin@stockscout.com',
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/settings/account')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({
        email: ' New-Admin@StockScout.com ',
      })
      .expect(200);

    expect(response.body.requiresReauthentication).toBe(true);
    expect(response.body.user.email).toBe('new-admin@stockscout.com');
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new-admin@stockscout.com',
        }),
      }),
    );
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: '11111111-1111-4111-8111-111111111111',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokeReason: 'self_login_identifier_changed',
      },
    });
    expect(response.headers['set-cookie']?.join(';')).toContain(
      `${cookieName}=;`,
    );
  });

  it('maps duplicate settings email changes to a safe conflict', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@stockscout.com',
    });
    prismaMock.user.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    const response = await request(app.getHttpServer())
      .patch('/settings/account')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({
        email: 'taken@stockscout.com',
      })
      .expect(409);

    expect(response.body.message).toBe('A user with this email already exists');
  });

  it('rejects settings password changes with the wrong current password', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        passwordHash,
      }),
    );

    await request(app.getHttpServer())
      .post('/settings/change-password')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({
        currentPassword: 'WrongPass123',
        newPassword: 'NewStrong123',
      })
      .expect(401);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('changes the authenticated administrator password and revokes sessions', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        passwordHash,
      }),
    );
    prismaMock.user.update.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .post('/settings/change-password')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({
        currentPassword: validPassword,
        newPassword: 'NewStrong123',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'Password changed successfully',
      requiresReauthentication: true,
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: '11111111-1111-4111-8111-111111111111',
        },
        data: expect.objectContaining({
          passwordHash: expect.any(String),
          passwordChangedAt: expect.any(Date),
          failedLoginAttempts: 0,
          lockedUntil: null,
        }),
      }),
    );
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: '11111111-1111-4111-8111-111111111111',
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokeReason: 'password_changed',
      },
    });
    expect(response.headers['set-cookie']?.join(';')).toContain(
      `${cookieName}=;`,
    );
  });

  it('enforces reset password policy on settings password changes', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());

    await request(app.getHttpServer())
      .post('/settings/change-password')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .set('Origin', env.FRONTEND_ORIGIN)
      .send({
        currentPassword: validPassword,
        newPassword: 'short',
      })
      .expect(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('blocks hostile origins on settings mutations before authentication', async () => {
    const response = await request(app.getHttpServer())
      .patch('/settings/account')
      .set('Origin', 'https://evil.example')
      .send({
        firstName: 'Blocked',
      })
      .expect(403);

    expect(response.body).toEqual({
      message: 'Cross-site request blocked',
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('allows administrators to list users with pagination and lastActive fields', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.user.findMany.mockResolvedValue([
      buildUser({
        id: '55555555-5555-4555-8555-555555555555',
        email: 'admin@stockscout.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMINISTRATOR',
        accountStatus: 'ACTIVE',
      }),
      buildUser({
        id: '66666666-6666-4666-8666-666666666666',
        email: 'staff@stockscout.com',
        firstName: 'Staff',
        lastName: 'User',
        role: 'STAFF',
        accountStatus: 'INACTIVE',
        isActive: false,
        lastLoginAt: new Date('2026-02-02T00:00:00.000Z'),
      }),
    ]);
    prismaMock.authSession.groupBy.mockResolvedValue([
      {
        userId: '55555555-5555-4555-8555-555555555555',
        _max: {
          lastSeenAt: new Date('2026-02-03T00:00:00.000Z'),
        },
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/users?page=1&pageSize=20')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(200);

    expect(response.body).toEqual({
      items: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Admin User',
          email: 'admin@stockscout.com',
          role: 'ADMINISTRATOR',
          status: 'ACTIVE',
          lastLoginAt: null,
          lastActive: '2026-02-03T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Staff User',
          email: 'staff@stockscout.com',
          role: 'STAFF',
          status: 'INACTIVE',
          lastLoginAt: '2026-02-02T00:00:00.000Z',
          lastActive: '2026-02-02T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 2,
        totalPages: 1,
      },
    });
  });

  it('returns safe user detail fields', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        id: '77777777-7777-4777-8777-777777777777',
        email: 'detail@stockscout.com',
        firstName: 'Detail',
        middleInitial: 'Q',
        lastName: 'User',
        role: 'STAFF',
      }),
    );
    prismaMock.authSession.aggregate.mockResolvedValue({
      _max: { lastSeenAt: new Date('2026-04-01T00:00:00.000Z') },
    });

    const response = await request(app.getHttpServer())
      .get('/users/77777777-7777-4777-8777-777777777777')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(200);

    expect(response.body).toEqual({
      user: {
        id: '77777777-7777-4777-8777-777777777777',
        firstName: 'Detail',
        middleInitial: 'Q',
        lastName: 'User',
        name: 'Detail Q. User',
        email: 'detail@stockscout.com',
        phone: '+639171234567',
        role: 'STAFF',
        status: 'ACTIVE',
        lastLoginAt: null,
        lastActive: '2026-04-01T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('creates pending staff users without returning sensitive fields', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.create.mockResolvedValue(
      buildUser({
        id: '88888888-8888-4888-8888-888888888888',
        email: 'created@stockscout.com',
        firstName: 'Created',
        lastName: 'User',
        role: 'STAFF',
        accountStatus: 'PENDING',
        isActive: false,
        passwordHash: null,
      }),
    );
    prismaMock.user.findUnique.mockResolvedValue({
      id: '88888888-8888-4888-8888-888888888888',
      email: 'created@stockscout.com',
      accountStatus: 'PENDING',
    });

    const response = await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .send({
        firstName: 'Created',
        lastName: 'User',
        email: 'created@stockscout.com',
        phone: '+639171111111',
        role: 'STAFF',
      })
      .expect(201);

    expect(response.body).toEqual({
      message: 'User created successfully',
      user: {
        id: '88888888-8888-4888-8888-888888888888',
        firstName: 'Created',
        middleInitial: null,
        lastName: 'User',
        name: 'Created User',
        email: 'created@stockscout.com',
        phone: '+639171234567',
        role: 'STAFF',
        status: 'PENDING',
        lastLoginAt: null,
        lastActive: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });
    expect(prismaMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          passwordHash: null,
          accountStatus: 'PENDING',
          isActive: false,
        }),
      }),
    );
  });

  it('rejects MANAGER assignment through user creation', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());

    await request(app.getHttpServer())
      .post('/users')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .send({
        firstName: 'Reserved',
        lastName: 'Manager',
        email: 'manager@stockscout.com',
        phone: '+639171111111',
        role: 'MANAGER',
      })
      .expect(400);
  });

  it('rejects self role changes', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';
    const session = buildSession({
      id: '99999999-9999-4999-8999-999999999999',
      email: 'self@stockscout.com',
      role: 'ADMINISTRATOR',
    });

    prismaMock.authSession.findUnique.mockResolvedValue(session);

    await request(app.getHttpServer())
      .patch('/users/99999999-9999-4999-8999-999999999999')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .send({
        role: 'STAFF',
      })
      .expect(400);
  });

  it('revokes active sessions when a managed user role changes', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';
    const targetUserId = '91919191-1111-4111-8111-111111111111';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        id: targetUserId,
        email: 'role-change@stockscout.com',
        role: 'STAFF',
      }),
    );
    prismaMock.user.update.mockResolvedValue(
      buildUser({
        id: targetUserId,
        email: 'role-change@stockscout.com',
        role: 'ADMINISTRATOR',
      }),
    );

    await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set('Cookie', `${cookieName}=raw-session-token`)
      .send({
        role: 'ADMINISTRATOR',
      })
      .expect(200);

    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: targetUserId,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokeReason: 'role_changed',
      },
    });
  });

  it('revokes active sessions when a managed user email changes', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';
    const targetUserId = '92929292-2222-4222-8222-222222222222';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        id: targetUserId,
        email: 'old-login@stockscout.com',
        role: 'STAFF',
      }),
    );
    prismaMock.user.update.mockResolvedValue(
      buildUser({
        id: targetUserId,
        email: 'new-login@stockscout.com',
        role: 'STAFF',
      }),
    );

    await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set('Cookie', `${cookieName}=raw-session-token`)
      .send({
        email: 'new-login@stockscout.com',
      })
      .expect(200);

    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: targetUserId,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        revokeReason: 'login_identifier_changed',
      },
    });
  });

  it('does not revoke sessions for harmless managed profile edits', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';
    const targetUserId = '93939393-3333-4333-8333-333333333333';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        id: targetUserId,
        email: 'profile@stockscout.com',
        role: 'STAFF',
      }),
    );
    prismaMock.user.update.mockResolvedValue(
      buildUser({
        id: targetUserId,
        email: 'profile@stockscout.com',
        firstName: 'Updated',
        role: 'STAFF',
      }),
    );

    await request(app.getHttpServer())
      .patch(`/users/${targetUserId}`)
      .set('Cookie', `${cookieName}=raw-session-token`)
      .send({
        firstName: 'Updated',
        phone: '+639172222222',
      })
      .expect(200);

    expect(prismaMock.authSession.updateMany).not.toHaveBeenCalled();
  });

  it('suspends active users and revokes their sessions', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(
      buildSession({
        id: 'aaaaaaaa-1111-4111-8111-111111111111',
        email: 'admin@stockscout.com',
        role: 'ADMINISTRATOR',
      }),
    );
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        id: 'bbbbbbbb-2222-4222-8222-222222222222',
        email: 'staff@stockscout.com',
        role: 'STAFF',
      }),
    );
    prismaMock.user.update.mockResolvedValue(
      buildUser({
        id: 'bbbbbbbb-2222-4222-8222-222222222222',
        email: 'staff@stockscout.com',
        role: 'STAFF',
        accountStatus: 'INACTIVE',
        isActive: false,
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/users/bbbbbbbb-2222-4222-8222-222222222222/suspend')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(201);

    expect(response.body.message).toBe('User suspended successfully');
    expect(prismaMock.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revokeReason: 'account_suspended',
        }),
      }),
    );
  });

  it('prevents suspending the last active administrator', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(
      buildSession({
        id: 'cccccccc-3333-4333-8333-333333333333',
        email: 'other-admin@stockscout.com',
        role: 'ADMINISTRATOR',
      }),
    );
    prismaMock.user.findUnique.mockResolvedValue(
      buildUser({
        id: 'dddddddd-4444-4444-8444-444444444444',
        email: 'admin-target@stockscout.com',
        role: 'ADMINISTRATOR',
        accountStatus: 'ACTIVE',
      }),
    );
    prismaMock.user.count.mockResolvedValue(1);

    await request(app.getHttpServer())
      .post('/users/dddddddd-4444-4444-8444-444444444444/suspend')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(409);
  });

  it('lists safe session metadata for a user', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'eeeeeeee-5555-4555-8555-555555555555',
    });
    prismaMock.authSession.findMany.mockResolvedValue([
      {
        id: 'session-a',
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        lastSeenAt: new Date('2026-05-02T00:00:00.000Z'),
        expiresAt: new Date('2099-05-01T00:00:00.000Z'),
        idleExpiresAt: new Date('2099-05-01T00:00:00.000Z'),
        revokedAt: null,
        revokeReason: null,
        ipAddress: '127.0.0.1',
        userAgent: 'jest',
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/users/eeeeeeee-5555-4555-8555-555555555555/sessions')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(200);

    expect(response.body).toEqual({
      sessions: [
        {
          id: 'session-a',
          createdAt: '2026-05-01T00:00:00.000Z',
          lastSeenAt: '2026-05-02T00:00:00.000Z',
          expiresAt: '2099-05-01T00:00:00.000Z',
          idleExpiresAt: '2099-05-01T00:00:00.000Z',
          revokedAt: null,
          revokeReason: null,
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
      ],
    });
  });

  it('rejects revoking a session that does not belong to the selected user', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'ffffffff-6666-4666-8666-666666666666',
    });
    prismaMock.authSession.findFirst.mockResolvedValue(null);

    await request(app.getHttpServer())
      .delete(
        '/users/ffffffff-6666-4666-8666-666666666666/sessions/12121212-1212-4121-8121-121212121212',
      )
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(404);
  });

  it('returns bounded real activity data', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
    });
    prismaMock.authSession.count.mockResolvedValue(1);
    prismaMock.order.count.mockResolvedValue(1);
    prismaMock.authSession.findMany.mockResolvedValue([
      {
        id: 'session-a',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        lastSeenAt: new Date('2026-06-03T00:00:00.000Z'),
        expiresAt: new Date('2099-06-01T00:00:00.000Z'),
        idleExpiresAt: new Date('2099-06-01T00:00:00.000Z'),
        revokedAt: null,
        revokeReason: null,
      },
    ]);
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal('120.50'),
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        completedAt: new Date('2026-06-02T00:10:00.000Z'),
      },
    ]);

    const response = await request(app.getHttpServer())
      .get(
        '/users/11111111-1111-4111-8111-111111111111/activity?page=1&pageSize=20',
      )
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(200);

    expect(response.body.items).toEqual([
      {
        type: 'SESSION',
        occurredAt: '2026-06-03T00:00:00.000Z',
        referenceId: 'session-a',
        details: {
          createdAt: '2026-06-01T00:00:00.000Z',
          expiresAt: '2099-06-01T00:00:00.000Z',
          idleExpiresAt: '2099-06-01T00:00:00.000Z',
          revokedAt: null,
          revokeReason: null,
        },
      },
      {
        type: 'ORDER',
        occurredAt: '2026-06-02T00:00:00.000Z',
        referenceId: 'order-1',
        details: {
          status: 'COMPLETED',
          totalAmount: '120.5',
          completedAt: '2026-06-02T00:10:00.000Z',
        },
      },
    ]);
    expect(response.body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
      boundedWindow: 20,
    });
  });

  it('blocks deleting users with protected historical records', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'abababab-7777-4777-8777-777777777777',
      role: 'STAFF',
      accountStatus: 'INACTIVE',
      _count: {
        createdOrders: 1,
        createdStockRuns: 0,
        inventoryTransactions: 0,
        acknowledgedAlerts: 0,
        dismissedAlerts: 0,
        orderReversals: 0,
        archivedProducts: 0,
      },
    });

    const response = await request(app.getHttpServer())
      .delete('/users/abababab-7777-4777-8777-777777777777')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(409);

    expect(response.body.message).toBe(
      'Cannot delete user with historical records. Set the account to INACTIVE instead.',
    );
    expect(prismaMock.user.delete).not.toHaveBeenCalled();
  });

  it('deletes dependency-free users safely', async () => {
    const cookieName = process.env.SESSION_COOKIE_NAME ?? 'ims_session';

    prismaMock.authSession.findUnique.mockResolvedValue(buildSession());
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'cdcdcdcd-8888-4888-8888-888888888888',
      role: 'STAFF',
      accountStatus: 'INACTIVE',
      _count: {
        createdOrders: 0,
        createdStockRuns: 0,
        inventoryTransactions: 0,
        acknowledgedAlerts: 0,
        dismissedAlerts: 0,
        orderReversals: 0,
        archivedProducts: 0,
      },
    });
    prismaMock.user.delete.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .delete('/users/cdcdcdcd-8888-4888-8888-888888888888')
      .set('Cookie', `${cookieName}=raw-session-token`)
      .expect(200);

    expect(response.body).toEqual({
      message: 'User deleted successfully',
    });
    expect(prismaMock.user.delete).toHaveBeenCalled();
  });
});
