import { saveProfilePicture, removeProfilePicture } from './profile-picture';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildUserName } from '../users/user.mapper';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateAccountSettingsDto } from './dto/update-account-settings.dto';

const selfAccountSelect = {
  id: true,
  firstName: true,
  middleInitial: true,
  lastName: true,
  email: true,
  phone: true,
  profilePictureUrl: true,
  role: true,
  accountStatus: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const passwordChangeSelect = {
  id: true,
  passwordHash: true,
  role: true,
  accountStatus: true,
} satisfies Prisma.UserSelect;

type SelfAccount = Prisma.UserGetPayload<{ select: typeof selfAccountSelect }>;

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function mapSelfAccount(user: SelfAccount) {
  return {
    id: user.id,
    firstName: user.firstName,
    middleInitial: user.middleInitial,
    lastName: user.lastName,
    name: buildUserName(user),
    email: user.email,
    phone: user.phone,
    profilePictureUrl: user.profilePictureUrl,
    role: user.role,
    status: user.accountStatus,
    lastLoginAt: toIso(user.lastLoginAt),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async getAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: selfAccountSelect,
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    return mapSelfAccount(user);
  }

  async updateAccount(
    userId: string,
    dto: UpdateAccountSettingsDto,
    file?: Express.Multer.File,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        profilePictureUrl: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) {
      updateData.firstName = dto.firstName;
    }
    if (dto.middleInitial !== undefined) {
      updateData.middleInitial = dto.middleInitial;
    }
    if (dto.lastName !== undefined) {
      updateData.lastName = dto.lastName;
    }
    if (dto.phone !== undefined) {
      updateData.phone = dto.phone;
    }
    if (dto.email !== undefined) {
      updateData.email = dto.email;
    }

    const emailChanged =
      dto.email !== undefined && dto.email !== existing.email;
    const now = new Date();
    const pictureUrl = file ? await saveProfilePicture(file) : undefined;
    if (pictureUrl) updateData.profilePictureUrl = pictureUrl;

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
          where: { id: userId },
          data: updateData,
          select: selfAccountSelect,
        });

        if (emailChanged) {
          await tx.authSession.updateMany({
            where: {
              userId,
              revokedAt: null,
            },
            data: {
              revokedAt: now,
              revokeReason: 'self_login_identifier_changed',
            },
          });
        }

        return updated;
      });

      if (pictureUrl) await removeProfilePicture(existing.profilePictureUrl);
      return {
        user: mapSelfAccount(user),
        requiresReauthentication: emailChanged,
      };
    } catch (error) {
      if (pictureUrl) await removeProfilePicture(pictureUrl);
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists');
      }

      throw error;
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: passwordChangeSelect,
    });

    if (!user?.passwordHash) {
      await this.passwordService.simulatePasswordCheck(dto.currentPassword);
      throw new UnauthorizedException('Invalid current password');
    }

    const isCurrentPasswordValid = await this.passwordService.verifyPassword(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Invalid current password');
    }

    const now = new Date();
    const passwordHash = await this.passwordService.hashPassword(
      dto.newPassword,
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.authSession.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: 'password_changed',
        },
      }),
    ]);

    return {
      requiresReauthentication: true,
    };
  }
}
