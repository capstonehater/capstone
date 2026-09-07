import { IsOptional, IsString } from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto';

export class PosProductPerformanceDto extends ReportFiltersDto {
  @IsOptional()
  @IsString()
  categoryId?: string;
}
