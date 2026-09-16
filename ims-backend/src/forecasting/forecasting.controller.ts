import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ForecastingService } from './forecasting.service';

export class GenerateForecastDto {
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate: string;
}

class ForecastFilterDto {
  @IsOptional()
  @IsString()
  productId?: string;
}

@Controller('forecasting')
@Roles(Role.ADMINISTRATOR)
export class ForecastingController {
  constructor(private readonly service: ForecastingService) {}

  @Get('products')
  products() { return this.service.products(); }

  @Get('latest')
  latest(@Query() filter: ForecastFilterDto) { return this.service.latest(filter.productId); }

  @Get('runs/:id')
  run(@Param('id') id: string) { return this.service.run(id); }

  @Post('runs')
  generate(@Body() body: GenerateForecastDto) { return this.service.generate(body.startDate); }
}
