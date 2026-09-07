import { Type } from 'class-transformer';
import { AlertSeverity, AlertState, AlertType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListAlertsDto {
  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @IsOptional()
  @IsEnum(AlertState)
  state?: AlertState;

  @IsOptional()
  @IsEnum(AlertSeverity)
  severity?: AlertSeverity;

  @IsOptional()
  @IsString()
  rawMaterialId?: string;

  @IsOptional()
  @IsString()
  stockBatchId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;
}
