import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { RecipesModule } from './recipes/recipes.module';
import { InventoryModule } from './inventory/inventory.module';
import { StockRunsModule } from './stock-runs/stock-runs.module';
import { OrdersModule } from './orders/orders.module';
import { AvailabilityModule } from './availability/availability.module';
import { EventsModule } from './events/events.module';
import { ReportsModule } from './reports/reports.module';
import { AlertsModule } from './alerts/alerts.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    RecipesModule,
    InventoryModule,
    StockRunsModule,
    OrdersModule,
    AvailabilityModule,
    EventsModule,
    ReportsModule,
    AlertsModule,
    SettingsModule,
  ],
})
export class AppModule {}
