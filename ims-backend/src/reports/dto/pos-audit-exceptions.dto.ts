import { OrderStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto';

export class PosAuditExceptionsDto extends ReportFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  staffSearch?: string;

  @IsOptional()
  @IsString()
  reasonSearch?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsIn(['ALL', 'REFUND', 'VOID', 'DISCOUNT'])
  exceptionType?: 'ALL' | 'REFUND' | 'VOID' | 'DISCOUNT';
}
