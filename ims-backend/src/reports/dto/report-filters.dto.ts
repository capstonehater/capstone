import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ReportFiltersDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}
