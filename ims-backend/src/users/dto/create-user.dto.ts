import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AssignableUserRole } from '../users.constants';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeMiddleInitial = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUserDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @Transform(normalizeMiddleInitial)
  @IsOptional()
  @IsString()
  @Length(1, 1)
  @Matches(/^[A-Z]$/, {
    message: 'middleInitial must be a single letter',
  })
  middleInitial?: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName: string;

  @Transform(normalizeEmail)
  @IsEmail()
  email: string;

  @Transform(trimString)
  @IsString()
  @MinLength(7)
  @MaxLength(32)
  @Matches(/^\+?[0-9()\-.\s]+$/, {
    message: 'phone must be a valid phone number',
  })
  phone: string;

  @IsEnum(AssignableUserRole)
  role: AssignableUserRole;
}
