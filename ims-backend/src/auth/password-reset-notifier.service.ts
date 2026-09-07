import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env.validation';

@Injectable()
export class PasswordResetNotifierService {
  private readonly logger = new Logger(PasswordResetNotifierService.name);

  buildResetUrl(token: string): string {
    const resetUrl = new URL('/reset-password', env.FRONTEND_APP_URL);
    resetUrl.searchParams.set('token', token);
    return resetUrl.toString();
  }

  async sendResetLink(options: {
    email: string;
    resetUrl: string;
  }): Promise<void> {
    if (env.NODE_ENV !== 'production') {
      this.logger.log(
        `Password reset link for ${options.email}: ${options.resetUrl}`,
      );
    }
  }
}
