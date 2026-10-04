import 'reflect-metadata';
import { validate } from 'class-validator';
import { ChangePasswordDto } from './change-password.dto';

jest.mock('../../auth/auth.constants', () => ({ MAX_PASSWORD_LENGTH: 72 }));

describe('Change password policy', () => {
  it.each(['Abcdefg!', 'Abcdefghijklmno!', 'Abcd123!'])('accepts valid password %s', async newPassword => {
    const dto = Object.assign(new ChangePasswordDto(), { currentPassword: 'ExistingPassword123456', newPassword });
    expect(await validate(dto)).toHaveLength(0);
  });
  it.each(['Abcdef!', 'Abcdefghijklmnop!', 'abcdefgh!', 'ABCDEFGH!', 'Abcdefgh', 'Abcdefg '])('rejects invalid password %s', async newPassword => {
    const dto = Object.assign(new ChangePasswordDto(), { currentPassword: 'existing', newPassword });
    expect((await validate(dto)).some(error => error.property === 'newPassword')).toBe(true);
  });
});
