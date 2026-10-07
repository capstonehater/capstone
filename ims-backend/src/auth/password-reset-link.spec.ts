import { AccountStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { PASSWORD_RESET_TTL_MS } from './auth.constants';

jest.mock('../config/env.validation', () => ({
  env: { AUTH_COOKIE_SAME_SITE: 'lax' },
}));

describe('single-use password links', () => {
  let service: AuthService;
  let tx: any;
  let link: any;
  beforeEach(() => {
    link = {
      id: 'link',
      userId: 'user',
      expiresAt: new Date(Date.now() + 60000),
      usedAt: null,
      user: { accountStatus: AccountStatus.ACTIVE },
    };
    tx = {
      passwordResetToken: {
        findUnique: jest.fn(async () => ({ ...link })),
        updateMany: jest.fn(async () => {
          if (link.usedAt) return { count: 0 };
          link.usedAt = new Date();
          return { count: 1 };
        }),
        create: jest.fn(async () => ({})),
      },
      user: { update: jest.fn() },
      authSession: { updateMany: jest.fn() },
    };
    const prisma = { ...tx, $transaction: (callback: any) => callback(tx) };
    service = new AuthService(
      prisma as any,
      {} as any,
      { hashPassword: jest.fn(async () => 'hashed') } as any,
      {} as any,
      {
        generateOpaqueToken: () => 'form-token',
        hashPasswordResetToken: (token: string) => token,
      } as any,
      { consumeResetPasswordAttempt: jest.fn() } as any,
      {} as any,
    );
  });
  it('sets the expiry to exactly 30 minutes', () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(30 * 60 * 1000);
  });
  it('consumes the email link and preserves its original deadline', async () => {
    const result = await service.redeemPasswordResetLink('email-token', {});
    expect(result).toEqual({ token: 'form-token', expiresAt: link.expiresAt });
    expect(tx.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: 'user',
        tokenHash: 'form:form-token',
        expiresAt: link.expiresAt,
      },
    });
    await expect(
      service.redeemPasswordResetLink('email-token', {}),
    ).rejects.toThrow('already been opened');
  });
  it('rejects expired links without creating a form credential', async () => {
    link.expiresAt = new Date(Date.now() - 1);
    await expect(
      service.redeemPasswordResetLink('email-token', {}),
    ).rejects.toThrow('expired');
    expect(tx.passwordResetToken.create).not.toHaveBeenCalled();
  });
  it('allows only one simultaneous opening', async () => {
    const results = await Promise.allSettled([
      service.redeemPasswordResetLink('email-token', {}),
      service.redeemPasswordResetLink('email-token', {}),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(tx.passwordResetToken.create).toHaveBeenCalledTimes(1);
  });
  it('allows only one simultaneous password submission', async () => {
    const results = await Promise.allSettled([
      service.resetPassword(
        { token: 'form-token', newPassword: 'Password123' },
        {},
      ),
      service.resetPassword(
        { token: 'form-token', newPassword: 'Password123' },
        {},
      ),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(tx.user.update).toHaveBeenCalledTimes(1);
    expect(tx.passwordResetToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: 'form:form-token' } }),
    );
  });
});
