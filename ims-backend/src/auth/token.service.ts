import { Injectable } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';
import { env } from '../config/env.validation';

@Injectable()
export class TokenService {
  generateOpaqueToken(byteLength = 48): string {
    return randomBytes(byteLength).toString('base64url');
  }

  hashSessionToken(token: string): string {
    return this.hashToken(token, env.SESSION_TOKEN_SECRET);
  }

  hashPasswordResetToken(token: string): string {
    return this.hashToken(token, env.RESET_TOKEN_SECRET);
  }

  private hashToken(token: string, secret: string): string {
    return createHmac('sha256', secret).update(token).digest('hex');
  }
}
