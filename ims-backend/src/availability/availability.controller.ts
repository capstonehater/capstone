import { Controller, Get, Param } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

@Controller('variants')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':id/availability')
  async getVariantAvailability(@Param('id') variantId: string) {
    return {
      availability:
        await this.availabilityService.getVariantAvailability(variantId),
    };
  }
}
