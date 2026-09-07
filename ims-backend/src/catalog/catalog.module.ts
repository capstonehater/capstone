import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { OrdersModule } from '../orders/orders.module';
import { RecipesModule } from '../recipes/recipes.module';
import { AdminProductsController } from './admin-products.controller';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProductManagementService } from './product-management.service';

@Module({
  imports: [AvailabilityModule, OrdersModule, RecipesModule],
  controllers: [CatalogController, AdminProductsController],
  providers: [CatalogService, ProductManagementService],
  exports: [CatalogService],
})
export class CatalogModule {}
