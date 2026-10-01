import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Role } from '@prisma/client';
import { UsersService } from './users.service';
import { AssignableUserRole } from './users.constants';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

const actor: AuthenticatedUser = {
  id: 'actor',
  role: Role.ADMINISTRATOR,
  email: 'test@example.invalid',
  name: 'Admin',
  isActive: true,
  sessionId: 'session',
};
describe('User account safeguards', () => {
  const tx = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    authSession: { findFirst: jest.fn(), updateMany: jest.fn() },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((action: (client: typeof tx) => unknown) =>
      action(tx),
    ),
  };
  const service = new UsersService(prisma as unknown as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    tx.user.findUnique.mockResolvedValue({
      id: 'target',
      role: Role.ADMINISTRATOR,
      accountStatus: AccountStatus.ACTIVE,
      isActive: true,
      accessRoles: [{ roleId: 'admin' }],
    });
    tx.user.count.mockResolvedValue(0);
    tx.authSession.updateMany.mockResolvedValue({ count: 2 });
  });
  it('rejects self suspension before a transaction', async () => {
    await expect(service.suspendUser(actor.id, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects self deletion before a transaction', async () => {
    await expect(service.deleteUser(actor.id, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects self role editing before a transaction', async () => {
    await expect(
      service.updateUser(
        actor.id,
        { role: AssignableUserRole.ADMINISTRATOR },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it.each(['suspend', 'delete', 'demote'])(
    'protects last Administrator during %s',
    async (action) => {
      const operation =
        action === 'suspend'
          ? service.suspendUser('target', actor)
          : action === 'delete'
            ? service.deleteUser('target', actor)
            : service.updateUser(
                'target',
                { role: AssignableUserRole.STAFF },
                actor,
              );
      await expect(operation).rejects.toBeInstanceOf(ConflictException);
      expect(tx.user.update).not.toHaveBeenCalled();
      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(tx.authSession.updateMany).not.toHaveBeenCalled();
    },
  );
  it('cannot revoke a session belonging to another user', async () => {
    tx.authSession.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.revokeUserSession('target', 'session-other'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.authSession.findFirst).toHaveBeenCalledWith({
      where: { id: 'session-other', userId: 'target' },
      select: { id: true },
    });
    expect(tx.authSession.updateMany).not.toHaveBeenCalled();
  });
  it('preserves revocation scope and reason for one session', async () => {
    tx.authSession.findFirst.mockResolvedValueOnce({ id: 'session-target' });
    await service.revokeUserSession('target', 'session-target');
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-target', revokedAt: null },
      data: {
        revokedAt: expect.any(Date) as unknown as Date,
        revokeReason: 'admin_revoked',
      },
    });
  });
  it('preserves revoke-all scope and count', async () => {
    await expect(service.revokeAllUserSessions('target')).resolves.toEqual({
      message: 'All active sessions revoked successfully',
      revokedCount: 2,
    });
    expect(tx.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'target', revokedAt: null },
      data: {
        revokedAt: expect.any(Date) as unknown as Date,
        revokeReason: 'admin_revoked_all',
      },
    });
  });
});
