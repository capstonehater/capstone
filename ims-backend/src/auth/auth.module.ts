import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthThrottleService } from './auth-throttle.service';
import { PasswordService } from './password.service';
import { PasswordResetNotifierService } from './password-reset-notifier.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthThrottleService,
    PasswordService,
    PasswordResetNotifierService,
    SessionService,
    TokenService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
  exports: [AuthService, PasswordService, SessionService],
})
export class AuthModule {}
