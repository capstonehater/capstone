import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';
import { InventoryStateHistoryService } from './inventory-state-history.service';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, InventoryStateHistoryService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
