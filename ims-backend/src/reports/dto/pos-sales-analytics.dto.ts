import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { ReportFiltersDto } from './report-filters.dto';

export class PosSalesAnalyticsDto extends ReportFiltersDto {
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly'])
  groupBy?: 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsString()
  staffSearch?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
