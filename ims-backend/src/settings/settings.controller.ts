import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_PROFILE_PICTURE_SIZE } from './profile-picture';
import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { clearAuthCookie } from '../auth/auth.cookies';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateAccountSettingsDto } from './dto/update-account-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@Roles(Role.ADMINISTRATOR)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('account')
  async getAccount(@CurrentUser() user: AuthenticatedUser) {
    return {
      user: await this.settingsService.getAccount(user.id),
    };
  }

  @Patch('account')
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      limits: { fileSize: MAX_PROFILE_PICTURE_SIZE, files: 1, fields: 5 },
    }),
  )
  async updateAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAccountSettingsDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.settingsService.updateAccount(user.id, dto, file);

    if (result.requiresReauthentication) {
      clearAuthCookie(response);
    }

    return {
      message: 'Account updated successfully',
      user: result.user,
      requiresReauthentication: result.requiresReauthentication,
    };
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.settingsService.changePassword(user.id, dto);

    clearAuthCookie(response);

    return {
      message: 'Password changed successfully',
      requiresReauthentication: result.requiresReauthentication,
    };
  }
}
