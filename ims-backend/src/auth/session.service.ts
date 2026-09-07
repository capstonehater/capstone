import { Injectable } from '@nestjs/common';
import { AccountStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { toAuthenticatedUser } from '../users/user.mapper';
import { SESSION_IDLE_TTL_MS, SESSION_TTL_MS } from './auth.constants';
import { TokenService } from './token.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
  ) {}

  async createSession(input: {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ sessionId: string; sessionToken: string; expiresAt: Date }> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_TTL_MS);
    const sessionToken = this.tokenService.generateOpaqueToken();
    const sessionTokenHash = this.tokenService.hashSessionToken(sessionToken);

    const session = await this.prisma.authSession.create({
      data: {
        userId: input.userId,
        sessionTokenHash,
        expiresAt,
        idleExpiresAt,
        ipAddress: input.ipAddress ?? undefined,
        userAgent: input.userAgent ?? undefined,
      },
    });

    return {
      sessionId: session.id,
      sessionToken,
      expiresAt,
    };
  }

  async validateSession(
    sessionToken: string,
  ): Promise<AuthenticatedUser | null> {
    const sessionTokenHash = this.tokenService.hashSessionToken(sessionToken);
    const now = new Date();

    const session = await this.prisma.authSession.findUnique({
      where: {
        sessionTokenHash,
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      return null;
    }

    if (
      session.revokedAt ||
      session.expiresAt <= now ||
      session.idleExpiresAt <= now
    ) {
      await this.revokeSessionById(session.id, 'session_expired');
      return null;
    }

    if (
      session.user.accountStatus !== AccountStatus.ACTIVE ||
      !session.user.isActive
    ) {
      await this.revokeSessionById(session.id, 'user_inactive');
      return null;
    }

    if (
      session.createdAt.getTime() < session.user.passwordChangedAt.getTime()
    ) {
      await this.revokeSessionById(session.id, 'password_changed');
      return null;
    }

    await this.prisma.authSession.update({
      where: {
        id: session.id,
      },
      data: {
        lastSeenAt: now,
        idleExpiresAt: new Date(now.getTime() + SESSION_IDLE_TTL_MS),
      },
    });

    return toAuthenticatedUser(session.user, session.id);
  }

  async revokeSessionByToken(
    sessionToken: string,
    reason = 'logout',
  ): Promise<void> {
    const sessionTokenHash = this.tokenService.hashSessionToken(sessionToken);

    await this.prisma.authSession.updateMany({
      where: {
        sessionTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }

  async revokeSessionById(sessionId: string, reason: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }

  async revokeAllUserSessions(userId: string, reason: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  }
}
