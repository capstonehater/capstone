import { Controller, Get, Param, Query } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { ForecastingService } from './forecasting.service';

class ForecastFilterDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  runId?: string;
}

@Controller('forecasting')
export class ForecastingController {
  constructor(private readonly service: ForecastingService) {}

  @Get('products')
  @RequirePermission('forecasting.view')
  products() {
    return this.service.products();
  }

  @Get('latest')
  @RequirePermission('forecasting.view')
  latest(@Query() filter: ForecastFilterDto) {
    return this.service.latest(filter.productId, filter.runId);
  }

  @Get('runs/:id')
  @RequirePermission('forecasting.view')
  run(@Param('id') id: string) {
    return this.service.run(id);
  }
}
