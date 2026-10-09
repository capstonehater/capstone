import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { env } from '../config/env.validation';
import { buildAccountEmail } from './account-email.template';

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
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM_EMAIL) {
      throw new ServiceUnavailableException(
        'Email delivery is not configured. Contact your administrator.',
      );
    }
    const transport = createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      requireTLS: true,
      tls: { minVersion: 'TLSv1.2' },
      auth: {
        user: SMTP_USER,
        pass:
          SMTP_HOST === 'smtp.gmail.com'
            ? SMTP_PASSWORD.replace(/\s/g, '')
            : SMTP_PASSWORD,
      },
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
        ...buildAccountEmail(options.resetUrl, options.isSetup),
      });
      if (!result.accepted.length || result.rejected.length)
        throw new Error('Recipient not accepted');
    } catch (error: unknown) {
      // Provider errors may include credentials or link content. Log only safe diagnostics.
      const details =
        error && typeof error === 'object'
          ? (error as Record<string, unknown>)
          : {};
      const code = [
        'EAUTH',
        'EENVELOPE',
        'EMESSAGE',
        'ECONNECTION',
        'ETIMEDOUT',
        'EDNS',
        'ESOCKET',
      ].includes(String(details.code))
        ? String(details.code)
        : 'UNKNOWN';
      const responseCode =
        typeof details.responseCode === 'number' &&
        Number.isInteger(details.responseCode) &&
        details.responseCode >= 400 &&
        details.responseCode <= 599
          ? details.responseCode
          : 'UNKNOWN';
      this.logger.error(
        `SMTP did not accept the account email (code=${code}, responseCode=${responseCode}). Check SMTP settings and provider logs.`,
      );
      throw new ServiceUnavailableException(
        'Unable to send the account email. Please try again later or contact your administrator.',
      );
    } finally {
      transport.close();
    }
  }
}
