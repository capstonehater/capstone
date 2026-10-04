import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  MAX_PASSWORD_LENGTH,
} from '../../auth/auth.constants';

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(16)
  @Matches(/^(?=[\s\S]*[a-z])(?=[\s\S]*[A-Z])(?=[\s\S]*[^A-Za-z0-9\s])[\s\S]+$/, {
    message:
      'Use 8–16 characters with uppercase, lowercase, and a special character',
  })
  newPassword: string;
}
