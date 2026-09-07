import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from '../../auth/auth.constants';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  newPassword: string;
}
