import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ArchiveProductDto } from './dto/archive-product.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { GetProductIngredientUsageDto } from './dto/get-product-ingredient-usage.dto';
import { ListAdminProductsDto } from './dto/list-admin-products.dto';
import { ReplaceVariantRecipeDto } from './dto/replace-variant-recipe.dto';
import { SetManualAvailabilityDto } from './dto/set-manual-availability.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductManagementService } from './product-management.service';

@Controller('admin')
export class AdminProductsController {
  constructor(
    private readonly productManagementService: ProductManagementService,
  ) {}

  @Get('products')
  @RequirePermission('products.view')
  async listProducts(@Query() query: ListAdminProductsDto) {
    return this.productManagementService.listAdminProducts(query);
  }

  @Get('products/:id')
  @RequirePermission('products.view')
  async getProduct(@Param('id') productId: string) {
    return this.productManagementService.getAdminProductDetail(productId);
  }

  @Post('products')
  @RequirePermission('products.create')
  async createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productManagementService.createProduct(dto, user.id);
  }

  @Patch('products/:id')
  @RequirePermission('products.edit')
  async updateProduct(
    @Param('id') productId: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productManagementService.updateProduct(productId, dto);
  }

  @Patch('products/:id/manual-availability')
  @RequirePermission('products.edit')
  async setProductManualAvailability(
    @Param('id') productId: string,
    @Body() dto: SetManualAvailabilityDto,
  ) {
    return this.productManagementService.setProductManualAvailability(
      productId,
      dto,
    );
  }

  @Post('products/:id/archive')
  @RequirePermission('products.archive')
  async archiveProduct(
    @Param('id') productId: string,
    @Body() dto: ArchiveProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productManagementService.archiveProduct(
      productId,
      user.id,
      dto,
    );
  }

  @Post('products/:id/restore')
  @RequirePermission('products.restore')
  async restoreProduct(@Param('id') productId: string) {
    return this.productManagementService.restoreProduct(productId);
  }

  @Get('products/:id/delete-eligibility')
  @RequirePermission('products.view')
  async getDeleteEligibility(@Param('id') productId: string) {
    return this.productManagementService.getProductDeleteEligibility(productId);
  }

  @Delete('products/:id')
  @RequirePermission('products.delete')
  async deleteProduct(@Param('id') productId: string) {
    return this.productManagementService.deleteProduct(productId);
  }

  @Post('products/:id/variants')
  @RequirePermission('products.create')
  async createVariant(
    @Param('id') productId: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.productManagementService.createVariant(productId, dto);
  }

  @Patch('variants/:id')
  @RequirePermission('products.edit')
  async updateVariant(
    @Param('id') variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.productManagementService.updateVariant(variantId, dto);
  }

  @Patch('variants/:id/manual-availability')
  @RequirePermission('products.edit')
  async setVariantManualAvailability(
    @Param('id') variantId: string,
    @Body() dto: SetManualAvailabilityDto,
  ) {
    return this.productManagementService.setVariantManualAvailability(
      variantId,
      dto,
    );
  }

  @Delete('variants/:id')
  @RequirePermission('products.delete')
  async deleteVariant(@Param('id') variantId: string) {
    return this.productManagementService.deleteVariant(variantId);
  }

  @Get('variants/:id/recipe')
  @RequirePermission('products.view')
  async getVariantRecipe(@Param('id') variantId: string) {
    return this.productManagementService.getVariantRecipe(variantId);
  }

  @Put('variants/:id/recipe')
  @RequirePermission('products.edit')
  async replaceVariantRecipe(
    @Param('id') variantId: string,
    @Body() dto: ReplaceVariantRecipeDto,
  ) {
    return this.productManagementService.replaceVariantRecipe(variantId, dto);
  }

  @Get('products/:id/ingredient-usage')
  @RequirePermission('products.view')
  async getProductIngredientUsage(
    @Param('id') productId: string,
    @Query() query: GetProductIngredientUsageDto,
  ) {
    return this.productManagementService.getProductIngredientUsage(
      productId,
      query,
    );
  }

  @Get('products/:id/orders/:orderId/ingredient-usage')
  @RequirePermission('products.view')
  async getOrderIngredientUsage(
    @Param('id') productId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.productManagementService.getOrderIngredientUsage(
      productId,
      orderId,
    );
  }
}
