import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
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

  @Post('categories')
  @RequirePermission('products.create')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return { category: await this.catalogService.createCategory(dto) };
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
