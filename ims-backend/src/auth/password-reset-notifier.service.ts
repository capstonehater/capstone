import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createTransport } from 'nodemailer';
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
    isSetup?: boolean;
  }): Promise<void> {
    // Automated tests must never send account links to real recipients.
    if (env.NODE_ENV === 'test') return;

    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL } =
      env;
    if (
      !SMTP_HOST &&
      !SMTP_USER &&
      !SMTP_PASSWORD &&
      !SMTP_FROM_EMAIL &&
      env.NODE_ENV !== 'production'
    ) {
      this.logger.log(
        `Password reset link for ${options.email}: ${options.resetUrl}`,
      );
      return;
    }
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM_EMAIL) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Contact your administrator.',
      );
    }

    const action = options.isSetup
      ? 'Set up your account'
      : 'Reset your password';
    const safeUrl = options.resetUrl.replace(
      /[&<>"']/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[character]!,
    );
    const transport = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      requireTLS: true,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    try {
      const result = await transport.sendMail({
        from: { name: env.SMTP_FROM_NAME, address: SMTP_FROM_EMAIL },
        to: options.email,
        subject: `Cafe Salvacion - ${action}`,
        text: `${action}\n\nOpen this link to choose your password:\n${options.resetUrl}\n\nThis link expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once. If you did not expect this email, you can ignore it.`,
        html: `<h1>${action}</h1><p>Open the link below to choose your Cafe Salvacion password.</p><p><a href="${safeUrl}">${action}</a></p><p>This link expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.</p><p>If you did not expect this email, you can ignore it.</p>`,
      });
      if (result.accepted.length === 0)
        throw new Error('Recipient not accepted');
    } catch {
      // SMTP errors may contain credentials or message content; do not expose them.
      this.logger.error(
        'SMTP did not accept the account email. Check SMTP settings and provider logs.',
      );
      throw new ServiceUnavailableException(
        'Unable to send the account email. Please try again later or contact your administrator.',
      );
    } finally {
      transport.close();
    }
  }
}
