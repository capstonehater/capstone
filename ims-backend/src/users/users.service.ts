import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Prisma, Role, User } from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { buildUserName } from './user.mapper';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUserActivityDto } from './dto/list-user-activity.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  AssignableUserRole,
  DEFAULT_USER_ACTIVITY_PAGE,
  DEFAULT_USER_ACTIVITY_PAGE_SIZE,
  DEFAULT_USER_PAGE,
  DEFAULT_USER_PAGE_SIZE,
  MAX_USER_ACTIVITY_WINDOW,
} from './users.constants';

const authUserSelect = {
  id: true,
  email: true,
  username: true,
  passwordHash: true,
  profilePictureUrl: true,
  firstName: true,
  lastName: true,
  middleInitial: true,
  role: true,
  accountStatus: true,
  isActive: true,
  passwordChangedAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
} satisfies Prisma.UserSelect;

const userSummarySelect = {
  id: true,
  email: true,
  firstName: true,
  middleInitial: true,
  lastName: true,
  phone: true,
  role: true,
  accountStatus: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const userDeleteGuardSelect = {
  id: true,
  role: true,
  accountStatus: true,
  _count: {
    select: {
      createdOrders: true,
      createdStockRuns: true,
      inventoryTransactions: true,
      acknowledgedAlerts: true,
      dismissedAlerts: true,
      orderReversals: true,
      archivedProducts: true,
    },
  },
} satisfies Prisma.UserSelect;

type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof authUserSelect;
}>;

type UserSummaryRecord = Prisma.UserGetPayload<{
  select: typeof userSummarySelect;
}>;

type UserDeleteGuardRecord = Prisma.UserGetPayload<{
  select: typeof userDeleteGuardSelect;
}>;

type ManagedSessionRecord = Prisma.AuthSessionGetPayload<{
  select: {
    id: true;
    createdAt: true;
    lastSeenAt: true;
    expiresAt: true;
    idleExpiresAt: true;
    revokedAt: true;
    revokeReason: true;
    ipAddress: true;
    userAgent: true;
  };
}>;

function isUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function isActiveAccountStatus(status: AccountStatus): boolean {
  return status === AccountStatus.ACTIVE;
}

function toManagedRole(role: AssignableUserRole): Role {
  return role as Role;
}

function buildPagination(page: number, pageSize: number, totalItems: number) {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
  };
}

function normalizeOptionalMiddleInitial(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? null : value;
}

function buildUserSearchWhere(search?: string): Prisma.UserWhereInput[] {
  if (!search) {
    return [];
  }

  const normalized = search.trim();
  if (!normalized) {
    return [];
  }

  const tokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const tokenFilters =
    tokens.length > 1
      ? tokens.map<Prisma.UserWhereInput>((token) => ({
          OR: [
            { firstName: { contains: token, mode: 'insensitive' } },
            { lastName: { contains: token, mode: 'insensitive' } },
            { email: { contains: token, mode: 'insensitive' } },
          ],
        }))
      : [];

  return [
    {
      OR: [
        { firstName: { contains: normalized, mode: 'insensitive' } },
        { lastName: { contains: normalized, mode: 'insensitive' } },
        { email: { contains: normalized, mode: 'insensitive' } },
        { id: normalized },
        ...(tokenFilters.length > 0 ? [{ AND: tokenFilters }] : []),
      ],
    },
  ];
}

function mapUserSummary(
  user: UserSummaryRecord,
  lastActive: Date | null,
): {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  lastLoginAt: Date | null;
  lastActive: Date | null;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: user.id,
    name: buildUserName(user),
    email: user.email,
    role: user.role,
    status: user.accountStatus,
    lastLoginAt: user.lastLoginAt,
    lastActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapUserDetail(
  user: UserSummaryRecord,
  lastActive: Date | null,
): {
  id: string;
  firstName: string;
  middleInitial: string | null;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: AccountStatus;
  lastLoginAt: Date | null;
  lastActive: Date | null;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: user.id,
    firstName: user.firstName,
    middleInitial: user.middleInitial,
    lastName: user.lastName,
    name: buildUserName(user),
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.accountStatus,
    lastLoginAt: user.lastLoginAt,
    lastActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapManagedSession(session: ManagedSessionRecord) {
  return {
    id: session.id,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
    idleExpiresAt: session.idleExpiresAt,
    revokedAt: session.revokedAt,
    revokeReason: session.revokeReason,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
  };
}

function buildProtectedHistoryBlockers(user: UserDeleteGuardRecord): string[] {
  const blockers: string[] = [];

  if (user._count.createdOrders > 0) {
    blockers.push('orders');
  }
  if (user._count.orderReversals > 0) {
    blockers.push('orderReversals');
  }
  if (user._count.createdStockRuns > 0) {
    blockers.push('stockRuns');
  }
  if (user._count.inventoryTransactions > 0) {
    blockers.push('inventoryTransactions');
  }
  if (user._count.acknowledgedAlerts > 0) {
    blockers.push('acknowledgedAlerts');
  }
  if (user._count.dismissedAlerts > 0) {
    blockers.push('dismissedAlerts');
  }
  if (user._count.archivedProducts > 0) {
    blockers.push('archivedProducts');
  }

  return blockers;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmailForAuth(email: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: authUserSelect,
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findPasswordResetTargetById(id: string): Promise<{
    id: string;
    email: string;
    accountStatus: AccountStatus;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        accountStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async recordFailedLogin(
    userId: string,
    options: { lockUntil?: Date },
  ): Promise<void> {
    const data: Prisma.UserUpdateInput = {
      failedLoginAttempts: {
        increment: 1,
      },
    };

    if (options.lockUntil) {
      data.lockedUntil = options.lockUntil;
    }

    await this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async listUsers(query: ListUsersDto) {
    const page = query.page ?? DEFAULT_USER_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_USER_PAGE_SIZE;
    const where: Prisma.UserWhereInput = {
      AND: [
        ...buildUserSearchWhere(query.search),
        ...(query.role ? [{ role: query.role }] : []),
        ...(query.status ? [{ accountStatus: query.status }] : []),
      ],
    };

    const [totalItems, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
          { createdAt: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: userSummarySelect,
      }),
    ]);

    const lastActiveMap = await this.getLastActiveMap(
      users.map((user) => user.id),
    );

    return {
      items: users.map((user) =>
        mapUserSummary(user, lastActiveMap.get(user.id) ?? user.lastLoginAt),
      ),
      pagination: buildPagination(page, pageSize, totalItems),
    };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: userSummarySelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const lastActive = await this.getLastActiveForUser(id, user.lastLoginAt);
    return mapUserDetail(user, lastActive);
  }

  async createUser(dto: CreateUserDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: null,
          firstName: dto.firstName,
          middleInitial: normalizeOptionalMiddleInitial(dto.middleInitial),
          lastName: dto.lastName,
          phone: dto.phone,
          role: toManagedRole(dto.role),
          accountStatus: AccountStatus.PENDING,
          isActive: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        select: userSummarySelect,
      });

      return mapUserDetail(user, null);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A user with this email already exists');
      }

      throw error;
    }
  }

  async updateUser(
    targetUserId: string,
    dto: UpdateUserDto,
    actor: AuthenticatedUser,
  ) {
    if (actor.id === targetUserId && dto.role !== undefined) {
      throw new BadRequestException('You cannot change your own role');
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) {
      updateData.firstName = dto.firstName;
    }
    if (dto.middleInitial !== undefined) {
      updateData.middleInitial = normalizeOptionalMiddleInitial(
        dto.middleInitial,
      );
    }
    if (dto.lastName !== undefined) {
      updateData.lastName = dto.lastName;
    }
    if (dto.email !== undefined) {
      updateData.email = dto.email;
    }
    if (dto.phone !== undefined) {
      updateData.phone = dto.phone;
    }
    if (dto.role !== undefined) {
      updateData.role = toManagedRole(dto.role);
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'At least one updatable field must be provided',
      );
    }

    try {
      const user = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.user.findUnique({
            where: { id: targetUserId },
            select: userSummarySelect,
          });

          if (!existing) {
            throw new NotFoundException('User not found');
          }

          const requestedRole =
            dto.role !== undefined ? toManagedRole(dto.role) : undefined;

          if (
            dto.role !== undefined &&
            existing.role === Role.ADMINISTRATOR &&
            existing.accountStatus === AccountStatus.ACTIVE &&
            requestedRole !== Role.ADMINISTRATOR
          ) {
            await this.assertNotLastActiveAdministrator(tx, existing.id);
          }

          const roleChanged =
            requestedRole !== undefined && requestedRole !== existing.role;
          const emailChanged =
            dto.email !== undefined && dto.email !== existing.email;

          const updated = await tx.user.update({
            where: { id: targetUserId },
            data: updateData,
            select: userSummarySelect,
          });

          if (roleChanged || emailChanged) {
            await tx.authSession.updateMany({
              where: {
                userId: existing.id,
                revokedAt: null,
              },
              data: {
                revokedAt: new Date(),
                revokeReason:
                  roleChanged && emailChanged
                    ? 'role_and_login_identifier_changed'
                    : roleChanged
                      ? 'role_changed'
                      : 'login_identifier_changed',
              },
            });
          }

          return updated;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      const lastActive = await this.getLastActiveForUser(
        user.id,
        user.lastLoginAt,
      );

      return mapUserDetail(user, lastActive);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('A user with this email already exists');
      }

      throw error;
    }
  }

  async suspendUser(targetUserId: string, actor: AuthenticatedUser) {
    if (actor.id === targetUserId) {
      throw new BadRequestException('You cannot suspend your own account');
    }

    const user = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.user.findUnique({
          where: { id: targetUserId },
          select: userSummarySelect,
        });

        if (!existing) {
          throw new NotFoundException('User not found');
        }

        if (existing.accountStatus === AccountStatus.PENDING) {
          throw new BadRequestException('Pending accounts cannot be suspended');
        }

        if (existing.accountStatus === AccountStatus.INACTIVE) {
          throw new BadRequestException('User is already inactive');
        }

        if (existing.role === Role.ADMINISTRATOR) {
          await this.assertNotLastActiveAdministrator(tx, existing.id);
        }

        await tx.authSession.updateMany({
          where: {
            userId: existing.id,
            revokedAt: null,
          },
          data: {
            revokedAt: new Date(),
            revokeReason: 'account_suspended',
          },
        });

        return tx.user.update({
          where: { id: existing.id },
          data: {
            accountStatus: AccountStatus.INACTIVE,
            isActive: false,
          },
          select: userSummarySelect,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    const lastActive = await this.getLastActiveForUser(
      user.id,
      user.lastLoginAt,
    );
    return mapUserDetail(user, lastActive);
  }

  async reactivateUser(targetUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: userSummarySelect,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.accountStatus === AccountStatus.PENDING) {
      throw new BadRequestException(
        'Pending accounts must complete account setup before activation',
      );
    }

    if (user.accountStatus === AccountStatus.ACTIVE) {
      throw new BadRequestException('User is already active');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        accountStatus: AccountStatus.ACTIVE,
        isActive: true,
      },
      select: userSummarySelect,
    });

    const lastActive = await this.getLastActiveForUser(
      updated.id,
      updated.lastLoginAt,
    );

    return mapUserDetail(updated, lastActive);
  }

  async listUserSessions(targetUserId: string) {
    await this.ensureUserExists(targetUserId);

    const sessions = await this.prisma.authSession.findMany({
      where: {
        userId: targetUserId,
      },
      orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
        idleExpiresAt: true,
        revokedAt: true,
        revokeReason: true,
        ipAddress: true,
        userAgent: true,
      },
    });

    return {
      sessions: sessions.map(mapManagedSession),
    };
  }

  async revokeUserSession(targetUserId: string, sessionId: string) {
    await this.ensureUserExists(targetUserId);

    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId: targetUserId,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found for user');
    }

    await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: 'admin_revoked',
      },
    });

    return {
      message: 'Session revoked successfully',
    };
  }

  async revokeAllUserSessions(targetUserId: string) {
    await this.ensureUserExists(targetUserId);

    const result = await this.prisma.authSession.updateMany({
      where: {
        userId: targetUserId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: 'admin_revoked_all',
      },
    });

    return {
      message: 'All active sessions revoked successfully',
      revokedCount: result.count,
    };
  }

  async listUserActivity(targetUserId: string, query: ListUserActivityDto) {
    await this.ensureUserExists(targetUserId);

    const page = query.page ?? DEFAULT_USER_ACTIVITY_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_USER_ACTIVITY_PAGE_SIZE;
    const take = Math.min(page * pageSize, MAX_USER_ACTIVITY_WINDOW);

    const [
      sessionCount,
      orderCount,
      stockRunCount,
      inventoryTransactionCount,
      orderReversalCount,
      archivedProductCount,
      acknowledgedAlertCount,
      dismissedAlertCount,
      sessions,
      orders,
      stockRuns,
      inventoryTransactions,
      orderReversals,
      archivedProducts,
      acknowledgedAlerts,
      dismissedAlerts,
    ] = await Promise.all([
      this.prisma.authSession.count({ where: { userId: targetUserId } }),
      this.prisma.order.count({ where: { createdByUserId: targetUserId } }),
      this.prisma.stockRun.count({ where: { createdByUserId: targetUserId } }),
      this.prisma.inventoryTransaction.count({
        where: { actorUserId: targetUserId },
      }),
      this.prisma.orderReversal.count({ where: { actorUserId: targetUserId } }),
      this.prisma.product.count({ where: { archivedById: targetUserId } }),
      this.prisma.alert.count({
        where: { acknowledgedByUserId: targetUserId },
      }),
      this.prisma.alert.count({
        where: { dismissedByUserId: targetUserId },
      }),
      this.prisma.authSession.findMany({
        where: { userId: targetUserId },
        orderBy: [{ lastSeenAt: 'desc' }, { createdAt: 'desc' }],
        take,
        select: {
          id: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          idleExpiresAt: true,
          revokedAt: true,
          revokeReason: true,
        },
      }),
      this.prisma.order.findMany({
        where: { createdByUserId: targetUserId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.stockRun.findMany({
        where: { createdByUserId: targetUserId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: {
          id: true,
          name: true,
          status: true,
          totalCost: true,
          createdAt: true,
          postedAt: true,
        },
      }),
      this.prisma.inventoryTransaction.findMany({
        where: { actorUserId: targetUserId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: {
          id: true,
          type: true,
          sourceType: true,
          createdAt: true,
        },
      }),
      this.prisma.orderReversal.findMany({
        where: { actorUserId: targetUserId },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take,
        select: {
          id: true,
          orderId: true,
          type: true,
          amount: true,
          occurredAt: true,
        },
      }),
      this.prisma.product.findMany({
        where: { archivedById: targetUserId },
        orderBy: [{ archivedAt: 'desc' }, { id: 'desc' }],
        take,
        select: {
          id: true,
          name: true,
          archivedAt: true,
          archiveReason: true,
        },
      }),
      this.prisma.alert.findMany({
        where: { acknowledgedByUserId: targetUserId },
        orderBy: [{ acknowledgedAt: 'desc' }, { id: 'desc' }],
        take,
        select: {
          id: true,
          type: true,
          state: true,
          acknowledgedAt: true,
        },
      }),
      this.prisma.alert.findMany({
        where: { dismissedByUserId: targetUserId },
        orderBy: [{ dismissedAt: 'desc' }, { id: 'desc' }],
        take,
        select: {
          id: true,
          type: true,
          state: true,
          dismissedAt: true,
        },
      }),
    ]);

    const items = [
      ...sessions.map((session) => ({
        type: 'SESSION' as const,
        occurredAt: session.lastSeenAt,
        referenceId: session.id,
        details: {
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          idleExpiresAt: session.idleExpiresAt,
          revokedAt: session.revokedAt,
          revokeReason: session.revokeReason,
        },
      })),
      ...orders.map((order) => ({
        type: 'ORDER' as const,
        occurredAt: order.createdAt,
        referenceId: order.id,
        details: {
          status: order.status,
          totalAmount: order.totalAmount.toString(),
          completedAt: order.completedAt,
        },
      })),
      ...stockRuns.map((stockRun) => ({
        type: 'STOCK_RUN' as const,
        occurredAt: stockRun.createdAt,
        referenceId: stockRun.id,
        details: {
          name: stockRun.name,
          status: stockRun.status,
          totalCost: stockRun.totalCost.toString(),
          postedAt: stockRun.postedAt,
        },
      })),
      ...inventoryTransactions.map((transaction) => ({
        type: 'INVENTORY_TRANSACTION' as const,
        occurredAt: transaction.createdAt,
        referenceId: transaction.id,
        details: {
          transactionType: transaction.type,
          sourceType: transaction.sourceType,
        },
      })),
      ...orderReversals.map((reversal) => ({
        type: 'ORDER_REVERSAL' as const,
        occurredAt: reversal.occurredAt,
        referenceId: reversal.id,
        details: {
          orderId: reversal.orderId,
          reversalType: reversal.type,
          amount: reversal.amount.toString(),
        },
      })),
      ...archivedProducts
        .filter((product) => product.archivedAt)
        .map((product) => ({
          type: 'PRODUCT_ARCHIVE' as const,
          occurredAt: product.archivedAt!,
          referenceId: product.id,
          details: {
            productName: product.name,
            archiveReason: product.archiveReason,
          },
        })),
      ...acknowledgedAlerts
        .filter((alert) => alert.acknowledgedAt)
        .map((alert) => ({
          type: 'ALERT_ACKNOWLEDGEMENT' as const,
          occurredAt: alert.acknowledgedAt!,
          referenceId: alert.id,
          details: {
            alertType: alert.type,
            state: alert.state,
          },
        })),
      ...dismissedAlerts
        .filter((alert) => alert.dismissedAt)
        .map((alert) => ({
          type: 'ALERT_DISMISSAL' as const,
          occurredAt: alert.dismissedAt!,
          referenceId: alert.id,
          details: {
            alertType: alert.type,
            state: alert.state,
          },
        })),
    ]
      .sort((left, right) => {
        const dateDelta =
          right.occurredAt.getTime() - left.occurredAt.getTime();
        if (dateDelta !== 0) {
          return dateDelta;
        }

        const typeDelta = left.type.localeCompare(right.type);
        if (typeDelta !== 0) {
          return typeDelta;
        }

        return left.referenceId.localeCompare(right.referenceId);
      })
      .slice((page - 1) * pageSize, page * pageSize);

    const totalItems =
      sessionCount +
      orderCount +
      stockRunCount +
      inventoryTransactionCount +
      orderReversalCount +
      archivedProductCount +
      acknowledgedAlertCount +
      dismissedAlertCount;

    return {
      items,
      pagination: {
        ...buildPagination(page, pageSize, totalItems),
        boundedWindow: take,
      },
    };
  }

  async deleteUser(targetUserId: string, actor: AuthenticatedUser) {
    if (actor.id === targetUserId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: targetUserId },
          select: userDeleteGuardSelect,
        });

        if (!user) {
          throw new NotFoundException('User not found');
        }

        if (
          user.role === Role.ADMINISTRATOR &&
          user.accountStatus === AccountStatus.ACTIVE
        ) {
          await this.assertNotLastActiveAdministrator(tx, user.id);
        }

        const blockers = buildProtectedHistoryBlockers(user);
        if (blockers.length > 0) {
          throw new ConflictException({
            message:
              'Cannot delete user with historical records. Set the account to INACTIVE instead.',
            blockers,
          });
        }

        await tx.user.delete({
          where: { id: user.id },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    return {
      message: 'User deleted successfully',
    };
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async getLastActiveMap(
    userIds: string[],
  ): Promise<Map<string, Date | null>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const groupedSessions = await this.prisma.authSession.groupBy({
      by: ['userId'],
      where: {
        userId: {
          in: userIds,
        },
      },
      _max: {
        lastSeenAt: true,
      },
    });

    return new Map(
      groupedSessions.map((session) => [
        session.userId,
        session._max.lastSeenAt,
      ]),
    );
  }

  private async getLastActiveForUser(
    userId: string,
    fallback: Date | null,
  ): Promise<Date | null> {
    const session = await this.prisma.authSession.aggregate({
      where: {
        userId,
      },
      _max: {
        lastSeenAt: true,
      },
    });

    return session._max.lastSeenAt ?? fallback;
  }

  private async assertNotLastActiveAdministrator(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        accountStatus: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (
      user.role !== Role.ADMINISTRATOR ||
      !isActiveAccountStatus(user.accountStatus)
    ) {
      return;
    }

    const activeAdministratorCount = await tx.user.count({
      where: {
        role: Role.ADMINISTRATOR,
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    if (activeAdministratorCount <= 1) {
      throw new ConflictException(
        'At least one active administrator must remain in the system',
      );
    }
  }
}
