import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { env } from '../config/env.validation';
import { PasswordResetNotifierService } from './password-reset-notifier.service';

jest.mock('../config/env.validation', () => ({
  env: {
    NODE_ENV: 'development',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'abcd efgh ijkl mnop',
    SMTP_FROM_EMAIL: 'sender@example.com',
    SMTP_FROM_NAME: 'Cafe Salvacion',
    FRONTEND_APP_URL: 'https://app.example.com',
  },
}));
jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('Google SMTP account email delivery', () => {
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
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 587,
      SMTP_USER: 'sender@example.com',
      SMTP_PASSWORD: 'abcd efgh ijkl mnop',
      SMTP_FROM_EMAIL: 'sender@example.com',
    });
    (createTransport as jest.Mock).mockReturnValue({ sendMail, close });
    sendMail.mockResolvedValue({ accepted: [options.email], rejected: [] });
    service = new PasswordResetNotifierService();
  });
  afterEach(() => jest.restoreAllMocks());
  it('uses authenticated STARTTLS, timeouts, and disables file and URL access', async () => {
    await service.sendResetLink(options);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        requireTLS: true,
        tls: { minVersion: 'TLSv1.2' },
        auth: { user: 'sender@example.com', pass: 'abcdefghijklmnop' },
        connectionTimeout: 10000,
        socketTimeout: 20000,
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('uses the supplied activation layout and the genuine single-use link', async () => {
    await service.sendResetLink({ ...options, isSetup: true });
    const message = sendMail.mock.calls[0][0];
    expect(message).toMatchObject({
      from: { name: 'Cafe Salvacion', address: 'sender@example.com' },
      to: options.email,
      subject: 'Cafe Salvacion - Set up your account',
    });
    expect(message.html).toContain('Welcome to Cafe Salvacion Team!');
    expect(message.html).toContain('Set up your account');
    expect(message.html).toContain(
      'Open the link below to choose your Cafe Salvacion password.',
    );
    expect(message.html).toContain(
      'href="https://app.example.com/reset-password?token=test&amp;x=1"',
    );
    expect(message.html).toContain(
      'expires in 30 minutes and can only be opened once',
    );
    expect(message.html).toContain(
      'Complete your password change in the first tab you open.',
    );
    expect(message.html).toContain(
      'If you did not expect this email, you can ignore it.',
    );
    expect(message.text).toContain(options.resetUrl);
    expect(message.html).not.toContain('link here');
  });
  it('keeps password reset emails distinct from activation', async () => {
    await service.sendResetLink(options);
    expect(sendMail.mock.calls[0][0].subject).toBe(
      'Cafe Salvacion - Reset your password',
    );
    expect(sendMail.mock.calls[0][0].html).not.toContain(
      'Welcome to Cafe Salvacion Team!',
    );
  });
  it('escapes link attributes so content cannot inject HTML', async () => {
    await service.sendResetLink({
      ...options,
      resetUrl: options.resetUrl + '\"<img src=x>',
    });
    const html = sendMail.mock.calls[0][0].html;
    expect(html).toContain('&quot;&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
  });
  it('uses implicit TLS on port 465', async () => {
    Object.assign(env, { SMTP_PORT: 465 });
    await service.sendResetLink(options);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ secure: true, requireTLS: true }),
    );
  });
  it.each(['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL'])(
    'fails closed when %s is missing',
    async (key) => {
      Object.assign(env, { [key]: undefined });
      await expect(service.sendResetLink(options)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(createTransport).not.toHaveBeenCalled();
    },
  );
  it('never sends real mail in automated test mode', async () => {
    Object.assign(env, { NODE_ENV: 'test' });
    await service.sendResetLink(options);
    expect(createTransport).not.toHaveBeenCalled();
  });
  it('rejects delivery failures and logs no secrets, links, recipient, or provider text', async () => {
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    sendMail.mockRejectedValueOnce(
      Object.assign(Error('private provider credentials'), {
        code: 'EAUTH',
        responseCode: 535,
        response: options.resetUrl,
      }),
    );
    await expect(service.sendResetLink(options)).rejects.toThrow(
      'Unable to send the account email',
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('code=EAUTH, responseCode=535'),
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(
      /private|token=test|recipient|abcdefghijklmnop/,
    );
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('does not report success when the recipient is rejected', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    sendMail.mockResolvedValueOnce({ accepted: [], rejected: [options.email] });
    await expect(service.sendResetLink(options)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(close).toHaveBeenCalledTimes(1);
  });
});
