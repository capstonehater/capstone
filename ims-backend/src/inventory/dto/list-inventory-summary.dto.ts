import { IsBooleanString, IsOptional, IsString } from 'class-validator';

export class ListInventorySummaryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsBooleanString()
  includeArchived?: string;
}
