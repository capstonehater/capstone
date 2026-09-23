import { Controller, Get, Param, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
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
@Roles(Role.ADMINISTRATOR)
export class ForecastingController {
  constructor(private readonly service: ForecastingService) {}

  @Get('products')
  products() { return this.service.products(); }

  @Get('latest')
  latest(@Query() filter: ForecastFilterDto) { return this.service.latest(filter.productId, filter.runId); }

  @Get('runs/:id')
  run(@Param('id') id: string) { return this.service.run(id); }

}
