import { ServiceUnavailableException } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { env } from '../config/env.validation';
import { PasswordResetNotifierService } from './password-reset-notifier.service';

jest.mock('../config/env.validation', () => ({
  env: {
    NODE_ENV: 'development',
    SMTP_HOST: 'smtp-relay.brevo.com',
    SMTP_PORT: 587,
    SMTP_USER: 'smtp-login',
    SMTP_PASSWORD: 'test-only',
    SMTP_FROM_EMAIL: 'sender@example.com',
    SMTP_FROM_NAME: 'Cafe Salvacion',
    FRONTEND_APP_URL: 'https://app.example.com',
    PASSWORD_RESET_TTL_MINUTES: 30,
  },
}));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('PasswordResetNotifierService SMTP delivery', () => {
  const sendMail = jest.fn();
  const close = jest.fn();
  const options = {
    email: 'recipient@example.com',
    resetUrl: 'https://app.example.com/reset-password?token=test&x=1',
  };
  let service: PasswordResetNotifierService;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(env, {
      NODE_ENV: 'development',
      SMTP_FROM_EMAIL: 'sender@example.com',
    });
    (createTransport as jest.Mock).mockReturnValue({ sendMail, close });
    sendMail.mockResolvedValue({ accepted: ['recipient@example.com'] });
    service = new PasswordResetNotifierService();
  });

  it('sends the setup link to the requested user with TLS and the verified sender', async () => {
    await service.sendResetLink({ ...options, isSetup: true });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ port: 587, secure: false, requireTLS: true }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'Cafe Salvacion', address: 'sender@example.com' },
        to: options.email,
        subject: 'Cafe Salvacion - Set up your account',
        text: expect.stringContaining(options.resetUrl),
        html: expect.stringContaining('token=test&amp;x=1'),
      }),
    );
    expect(close).toHaveBeenCalled();
  });

  it('uses password reset wording for existing accounts', async () => {
    await service.sendResetLink(options);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'Cafe Salvacion - Reset your password',
      }),
    );
  });

  it('reports SMTP failure without exposing provider errors', async () => {
    sendMail.mockRejectedValueOnce(new Error('sensitive provider details'));
    await expect(service.sendResetLink(options)).rejects.toThrow(
      'Unable to send the account email.',
    );
    expect(close).toHaveBeenCalled();
  });

  it('does not report success when no recipient was accepted', async () => {
    sendMail.mockResolvedValueOnce({ accepted: [] });
    await expect(service.sendResetLink(options)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('rejects incomplete SMTP configuration instead of silently logging a link', async () => {
    Object.assign(env, { SMTP_FROM_EMAIL: undefined });
    await expect(service.sendResetLink(options)).rejects.toThrow(
      'Email delivery is not configured.',
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('never sends real email in automated test mode', async () => {
    Object.assign(env, { NODE_ENV: 'test' });
    await service.sendResetLink(options);
    expect(createTransport).not.toHaveBeenCalled();
  });
});
