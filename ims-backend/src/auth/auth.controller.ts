import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { clearAuthCookie, setAuthCookie } from './auth.cookies';
import { LOGOUT_SUCCESS_MESSAGE } from './auth.constants';
import { AuthService } from './auth.service';
import {
  getClientIp,
  getUserAgent,
  readSessionTokenFromRequest,
} from './auth.utils';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: getClientIp(request),
      userAgent: getUserAgent(request),
    });

    setAuthCookie(response, result.sessionToken, result.expiresAt);

    return {
      message: result.message,
      user: result.user,
    };
  }

  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const sessionToken = readSessionTokenFromRequest(request);

    if (sessionToken) {
      await this.authService.logout(sessionToken);
    }

    clearAuthCookie(response);

    return {
      message: LOGOUT_SUCCESS_MESSAGE,
    };
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  @Public()
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() request: Request) {
    return this.authService.forgotPassword(dto, {
      ipAddress: getClientIp(request),
    });
  }

  @Public()
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto, @Req() request: Request) {
    return this.authService.resetPassword(dto, {
      ipAddress: getClientIp(request),
    });
  }
}
