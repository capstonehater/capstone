import { Controller, Get, Param } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('categories')
  async listCategories() {
    return {
      categories: await this.catalogService.listCategories(),
    };
  }

  @Get('products')
  @RequirePermission('products.view')
  async listProducts() {
    return {
      products: await this.catalogService.listProducts(),
    };
  }

  @Get('products/:id/variants')
  @RequirePermission('products.view')
  async listProductVariants(@Param('id') productId: string) {
    return {
      variants: await this.catalogService.listProductVariants(productId),
    };
  }

  @Get('pos/menu')
  @RequirePermission('pos.view')
  async getPosMenu() {
    return this.catalogService.getPosMenu();
  }
}
