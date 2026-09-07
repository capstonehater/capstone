import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { StockRunStatus } from '@prisma/client';

export class ListStockRunsDto {
  @IsOptional()
  @IsEnum(StockRunStatus)
  status?: StockRunStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  createdByUserId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
