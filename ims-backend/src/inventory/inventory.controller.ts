import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateInventoryWasteDto } from './dto/create-inventory-waste.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListInventorySummaryDto } from './dto/list-inventory-summary.dto';
import { ListInventoryTransactionsDto } from './dto/list-inventory-transactions.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InventoryActionsService } from './inventory-actions.service';
import { InventoryService } from './inventory.service';
import { StoreAvailabilityService } from './store-availability.service';

@Controller()
export class InventoryController {
  constructor(
    private readonly storeAvailabilityService: StoreAvailabilityService,
    private readonly inventoryService: InventoryService,
    private readonly inventoryActionsService: InventoryActionsService,
  ) {}

  @Get('raw-materials/:id/store-availability')
  @RequirePermission('suppliers.searchAvailability')
  async storeAvailability(@Param('id') id: string) {
    return { search: await this.storeAvailabilityService.latest(id) };
  }

  @Post('raw-materials/:id/store-availability')
  @RequirePermission('suppliers.searchAvailability')
  async searchStoreAvailability(@Param('id') id: string) {
    return { search: await this.storeAvailabilityService.start(id) };
  }

  @Post('units')
  @RequirePermission('inventory.create')
  async createUnit(@Body() dto: CreateUnitDto) {
    return { unit: await this.inventoryService.createUnit(dto) };
  }

  @Post('raw-materials/:id/units')
  @RequirePermission('inventory.edit')
  async createUnitForMaterial(@Param('id') id: string, @Body() dto: CreateUnitDto) {
    return { unit: await this.inventoryService.createUnitForMaterial(id, dto) };
  }

  @Get('units')
  @RequirePermission('inventory.view')
  async listUnits() {
    return {
      units: await this.inventoryService.listUnits(),
    };
  }

  @Get('raw-materials')
  @RequirePermission('inventory.view')
  async listRawMaterials() {
    return {
      rawMaterials: await this.inventoryService.listRawMaterials(),
    };
  }

  @Post('raw-materials')
  @RequirePermission('inventory.create')
  async createRawMaterial(@Body() dto: CreateRawMaterialDto) {
    return {
      rawMaterial: await this.inventoryService.createRawMaterial(dto),
    };
  }

  @Get('raw-materials/:id')
  @RequirePermission('inventory.view')
  async getRawMaterial(@Param('id') rawMaterialId: string) {
    return {
      rawMaterial:
        await this.inventoryService.getRawMaterialById(rawMaterialId),
    };
  }

  @Patch('raw-materials/:id')
  @RequirePermission('inventory.edit')
  async updateRawMaterial(
    @Param('id') rawMaterialId: string,
    @Body() dto: UpdateRawMaterialDto,
  ) {
    return {
      rawMaterial: await this.inventoryService.updateRawMaterial(
        rawMaterialId,
        dto,
      ),
    };
  }

  @Delete('raw-materials/:id')
  @RequirePermission('inventory.archive')
  async archiveRawMaterial(@Param('id') rawMaterialId: string) {
    return {
      rawMaterial:
        await this.inventoryService.archiveRawMaterial(rawMaterialId),
    };
  }

  @Post('raw-materials/:id/unarchive')
  @RequirePermission('inventory.archive')
  async unarchiveRawMaterial(@Param('id') rawMaterialId: string) {
    return { rawMaterial: await this.inventoryService.unarchiveRawMaterial(rawMaterialId) };
  }

  @Delete('raw-materials/:id/permanent')
  @RequirePermission('inventory.archive')
  async deleteRawMaterial(@Param('id') rawMaterialId: string) {
    return { deletedMaterial: await this.inventoryService.deleteRawMaterial(rawMaterialId) };
  }

  @Get('raw-materials/:id/batches')
  @RequirePermission('inventory.view')
  async listRawMaterialBatches(@Param('id') rawMaterialId: string) {
    return {
      batches:
        await this.inventoryService.listRawMaterialBatches(rawMaterialId),
    };
  }

  @Get('raw-materials/:id/transactions')
  @RequirePermission('inventory.view')
  async listRawMaterialTransactions(
    @Param('id') rawMaterialId: string,
    @Query() filters: ListInventoryTransactionsDto,
  ) {
    return {
      transactions:
        await this.inventoryActionsService.listTransactionsForRawMaterial(
          rawMaterialId,
          filters,
        ),
    };
  }

  @Get('stock-batches/:id/transactions')
  @RequirePermission('inventory.view')
  async listBatchTransactions(
    @Param('id') stockBatchId: string,
    @Query() filters: ListInventoryTransactionsDto,
  ) {
    return {
      transactions: await this.inventoryActionsService.listTransactionsForBatch(
        stockBatchId,
        filters,
      ),
    };
  }

  @Get('suppliers')
  @RequirePermission('suppliers.view')
  async listSuppliers() {
    return {
      suppliers: await this.inventoryService.listSuppliers(),
    };
  }

  @Post('suppliers')
  @RequirePermission('suppliers.create')
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return {
      supplier: await this.inventoryService.createSupplier(dto),
    };
  }

  @Patch('suppliers/:id')
  @RequirePermission('suppliers.edit')
  async updateSupplier(
    @Param('id') supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return {
      supplier: await this.inventoryService.updateSupplier(supplierId, dto),
    };
  }

  @Delete('suppliers/:id')
  @RequirePermission('suppliers.delete')
  async deleteSupplier(@Param('id') supplierId: string) {
    return {
      supplier: await this.inventoryService.deleteSupplier(supplierId),
    };
  }

  @Get('inventory/summary')
  @RequirePermission('inventory.view')
  async listInventorySummary(@Query() filters: ListInventorySummaryDto) {
    return {
      summaries: await this.inventoryService.listInventorySummary(filters),
    };
  }

  @Get('inventory/transactions')
  @RequirePermission('inventory.view')
  async listInventoryTransactions(
    @Query() filters: ListInventoryTransactionsDto,
  ) {
    return {
      transactions:
        await this.inventoryActionsService.listTransactions(filters),
    };
  }

  @Post('inventory/waste')
  @RequirePermission('inventory.waste')
  async logWaste(
    @Body() dto: CreateInventoryWasteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      transaction: await this.inventoryActionsService.logWaste(dto, user.id),
    };
  }

}
