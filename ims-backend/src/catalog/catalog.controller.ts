import { Controller, Get, Param } from '@nestjs/common';
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
  async listProducts() {
    return {
      products: await this.catalogService.listProducts(),
    };
  }

  @Get('products/:id/variants')
  async listProductVariants(@Param('id') productId: string) {
    return {
      variants: await this.catalogService.listProductVariants(productId),
    };
  }

  @Get('pos/menu')
  async getPosMenu() {
    return this.catalogService.getPosMenu();
  }
}
