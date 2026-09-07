import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { InventoryTransactionType } from '@prisma/client';

export class ListInventoryTransactionsDto {
  @IsOptional()
  @IsEnum(InventoryTransactionType)
  type?: InventoryTransactionType;

  @IsOptional()
  @IsString()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  rawMaterialId?: string;

  @IsOptional()
  @IsString()
  stockBatchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;
}
