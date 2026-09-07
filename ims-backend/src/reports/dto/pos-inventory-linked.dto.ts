import { IsOptional, IsString } from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto';

export class PosInventoryLinkedDto extends ReportFiltersDto {
  @IsOptional()
  @IsString()
  materialSearch?: string;

  @IsOptional()
  @IsString()
  variantSearch?: string;

  @IsOptional()
  @IsString()
  drilldownVariantId?: string;
}
