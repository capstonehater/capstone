import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RecipesModule } from '../recipes/recipes.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [
    RecipesModule,
    InventoryModule,
    AvailabilityModule,
    EventsModule,
    AuthModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PricingService],
  exports: [OrdersService],
})
export class OrdersModule {}
