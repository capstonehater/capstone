import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { EventsModule } from '../events/events.module';
import { InventoryActionsService } from './inventory-actions.service';
import { InventoryController } from './inventory.controller';
import { InventoryDailySnapshotService } from './inventory-daily-snapshot.service';
import { InventoryLedgerService } from './inventory-ledger.service';
import { InventoryService } from './inventory.service';
import { FEFOAllocator } from './fefo-allocator.service';
import { StoreAvailabilityService } from './store-availability.service';

@Module({
  imports: [AvailabilityModule, EventsModule],
  controllers: [InventoryController],
  providers: [
    StoreAvailabilityService,
    InventoryService,
    InventoryActionsService,
    InventoryLedgerService,
    InventoryDailySnapshotService,
    FEFOAllocator,
  ],
  exports: [
    InventoryService,
    InventoryActionsService,
    InventoryLedgerService,
    FEFOAllocator,
  ],
})
export class InventoryModule {}
