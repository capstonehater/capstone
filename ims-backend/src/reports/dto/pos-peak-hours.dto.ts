import { IsIn, IsOptional } from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto';

export class PosPeakHoursDto extends ReportFiltersDto {
  @IsOptional()
  @IsIn(['all', 'weekday', 'weekend'])
  dayType?: 'all' | 'weekday' | 'weekend';
}
