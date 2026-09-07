import { IsOptional, IsString } from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto';

export class PosRefundsVoidsDto extends ReportFiltersDto {
  @IsOptional()
  @IsString()
  staffSearch?: string;
}
