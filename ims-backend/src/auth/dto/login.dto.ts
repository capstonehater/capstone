import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH } from '../auth.constants';

export class LoginDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;
}
