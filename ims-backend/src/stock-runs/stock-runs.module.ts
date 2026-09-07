import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { EventsModule } from '../events/events.module';
import { InventoryModule } from '../inventory/inventory.module';
import { StockRunsController } from './stock-runs.controller';
import { StockRunsService } from './stock-runs.service';

@Module({
  imports: [InventoryModule, AvailabilityModule, EventsModule],
  controllers: [StockRunsController],
  providers: [StockRunsService],
})
export class StockRunsModule {}
