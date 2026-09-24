import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../config/env.validation';
import { toPublicUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import {
  FORGOT_PASSWORD_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_LOCKED_MESSAGE,
  PASSWORD_RESET_TTL_MS,
  RESET_PASSWORD_SUCCESS_MESSAGE,
} from './auth.constants';
import { AuthThrottleService } from './auth-throttle.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordService } from './password.service';
import { PasswordResetNotifierService } from './password-reset-notifier.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
    private readonly authThrottleService: AuthThrottleService,
    private readonly passwordResetNotifierService: PasswordResetNotifierService,
  ) {}

  private async createAndSendPasswordReset(input: {
    userId: string;
    email: string;
    includeDebugDetails: boolean;
    isSetup?: boolean;
  }): Promise<{
    message: string;
    debugResetToken?: string;
    debugResetUrl?: string;
  }> {
    const now = new Date();
    const resetToken = this.tokenService.generateOpaqueToken();
    const tokenHash = this.tokenService.hashPasswordResetToken(resetToken);
    const resetUrl =
      this.passwordResetNotifierService.buildResetUrl(resetToken);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: input.userId,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: input.userId,
          tokenHash,
          expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
        },
      }),
    ]);

    await this.passwordResetNotifierService.sendResetLink({
      email: input.email,
      resetUrl,
      isSetup: input.isSetup,
    });

    if (input.includeDebugDetails) {
      return {
        message: FORGOT_PASSWORD_MESSAGE,
        debugResetToken: resetToken,
        debugResetUrl: resetUrl,
      };
    }

    return {
      message: FORGOT_PASSWORD_MESSAGE,
    };
  }

  async issuePasswordResetForUserId(
    userId: string,
    options: {
      allowedStatuses: AccountStatus[];
      includeDebugDetails: boolean;
    },
  ): Promise<{
    message: string;
    debugResetToken?: string;
    debugResetUrl?: string;
  }> {
    const user = await this.usersService.findPasswordResetTargetById(userId);

    if (!options.allowedStatuses.includes(user.accountStatus)) {
      throw new BadRequestException(
        'Password reset is not available for the current account status',
      );
    }

    return this.createAndSendPasswordReset({
      userId: user.id,
      email: user.email,
      includeDebugDetails: options.includeDebugDetails,
      isSetup: user.accountStatus === AccountStatus.PENDING,
    });
  }

  async login(
    dto: LoginDto,
    requestMeta: { ipAddress?: string | null; userAgent?: string | null },
  ) {
    const user = await this.usersService.findByEmailForAuth(dto.email);

    if (!user) {
      await this.passwordService.simulatePasswordCheck(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      throw new HttpException(
        LOGIN_LOCKED_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (
      user.accountStatus !== AccountStatus.ACTIVE ||
      !user.passwordHash ||
      !user.isActive
    ) {
      await this.passwordService.simulatePasswordCheck(dto.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      const shouldLock = user.failedLoginAttempts + 1 >= env.LOGIN_MAX_ATTEMPTS;

      await this.usersService.recordFailedLogin(user.id, {
        lockUntil: shouldLock
          ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60 * 1000)
          : undefined,
      });

      if (shouldLock) {
        throw new HttpException(
          LOGIN_LOCKED_MESSAGE,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    await this.usersService.recordSuccessfulLogin(user.id);

    const session = await this.sessionService.createSession({
      userId: user.id,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return {
      message: 'Login successful',
      user: toPublicUser(user),
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
    };
  }

  async logout(sessionToken: string): Promise<void> {
    await this.sessionService.revokeSessionByToken(sessionToken, 'logout');
  }

  async authorizePrivilegedApproval(input: {
    email: string;
    password: string;
    allowedRoles: Role[];
  }) {
    const user = await this.usersService.findByEmailForAuth(
      input.email.trim().toLowerCase(),
    );

    if (
      !user ||
      user.accountStatus !== AccountStatus.ACTIVE ||
      !user.passwordHash ||
      !user.isActive
    ) {
      await this.passwordService.simulatePasswordCheck(input.password);
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      throw new HttpException(
        LOGIN_LOCKED_MESSAGE,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      input.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      const shouldLock = user.failedLoginAttempts + 1 >= env.LOGIN_MAX_ATTEMPTS;

      await this.usersService.recordFailedLogin(user.id, {
        lockUntil: shouldLock
          ? new Date(now.getTime() + env.LOGIN_LOCK_MINUTES * 60 * 1000)
          : undefined,
      });

      if (shouldLock) {
        throw new HttpException(
          LOGIN_LOCKED_MESSAGE,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    if (!input.allowedRoles.includes(user.role)) {
      throw new UnauthorizedException(
        'An administrator must approve this action',
      );
    }

    await this.usersService.recordSuccessfulLogin(user.id);

    return user;
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    requestMeta: { ipAddress?: string | null },
  ): Promise<{
    message: string;
    debugResetToken?: string;
    debugResetUrl?: string;
  }> {
    this.authThrottleService.consumeForgotPasswordAttempt(
      requestMeta.ipAddress,
    );
    const user = await this.usersService.findByEmailForAuth(dto.email);

    if (
      !user ||
      user.accountStatus !== AccountStatus.ACTIVE ||
      !user.isActive
    ) {
      return { message: FORGOT_PASSWORD_MESSAGE };
    }

    return this.createAndSendPasswordReset({
      userId: user.id,
      email: user.email,
      includeDebugDetails:
        env.NODE_ENV !== 'production' && env.EXPOSE_RESET_TOKEN_IN_DEV,
    });
  }

  async resetPassword(
    dto: ResetPasswordDto,
    requestMeta: { ipAddress?: string | null },
  ): Promise<{ message: string }> {
    this.authThrottleService.consumeResetPasswordAttempt(requestMeta.ipAddress);
    const tokenHash = this.tokenService.hashPasswordResetToken(dto.token);
    const now = new Date();

    const passwordResetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        user: {
          select: {
            id: true,
            accountStatus: true,
          },
        },
      },
    });

    if (
      !passwordResetToken ||
      passwordResetToken.usedAt ||
      passwordResetToken.expiresAt <= now
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const nextStatus =
      passwordResetToken.user.accountStatus === AccountStatus.PENDING
        ? AccountStatus.ACTIVE
        : passwordResetToken.user.accountStatus;

    const passwordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: passwordResetToken.userId,
        },
        data: {
          passwordHash,
          accountStatus: nextStatus,
          isActive: nextStatus === AccountStatus.ACTIVE,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: {
          id: passwordResetToken.id,
        },
        data: {
          usedAt: now,
        },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: passwordResetToken.userId,
          usedAt: null,
          id: {
            not: passwordResetToken.id,
          },
        },
        data: {
          usedAt: now,
        },
      }),
      this.prisma.authSession.updateMany({
        where: {
          userId: passwordResetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: 'password_reset',
        },
      }),
    ]);

    return { message: RESET_PASSWORD_SUCCESS_MESSAGE };
  }
}
