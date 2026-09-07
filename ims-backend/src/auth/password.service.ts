import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly DUMMY_PASSWORD_HASH =
    '$2b$10$CwTycUXWue0Thq9StjUM0uJ8G0sNch9GZk2un0nLBKBPXn1HULICW';

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PasswordService.SALT_ROUNDS);
  }

  async verifyPassword(
    password: string,
    passwordHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }

  async simulatePasswordCheck(password: string): Promise<void> {
    await bcrypt.compare(password, PasswordService.DUMMY_PASSWORD_HASH);
  }
}
