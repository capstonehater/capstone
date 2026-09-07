import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AccountStatus, Role } from '@prisma/client';
import {
  DEFAULT_USER_PAGE,
  DEFAULT_USER_PAGE_SIZE,
  MAX_USER_PAGE_SIZE,
} from '../users.constants';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ListUsersDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsEnum(AccountStatus)
  status?: AccountStatus;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_USER_PAGE;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_USER_PAGE_SIZE)
  pageSize: number = DEFAULT_USER_PAGE_SIZE;
}
