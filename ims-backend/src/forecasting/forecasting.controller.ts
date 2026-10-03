import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
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

class ForecastSettingsDto {
  @IsInt()
  @Min(1)
  @Max(30)
  forecastDays!: number;
}

@Controller('forecasting')
export class ForecastingController {
  constructor(private readonly service: ForecastingService) {}

  @Put('settings')
  @Roles(Role.ADMINISTRATOR)
  saveSettings(@Body() body: ForecastSettingsDto) {
    return this.service.saveSettings(body.forecastDays);
  }

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
