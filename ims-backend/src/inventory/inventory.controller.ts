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
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { CreateInventoryWasteDto } from './dto/create-inventory-waste.dto';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListInventorySummaryDto } from './dto/list-inventory-summary.dto';
import { ListInventoryTransactionsDto } from './dto/list-inventory-transactions.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InventoryActionsService } from './inventory-actions.service';
import { InventoryService } from './inventory.service';

const INVENTORY_READ_ROLES = [Role.ADMINISTRATOR, Role.STAFF] as const;

@Controller()
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly inventoryActionsService: InventoryActionsService,
  ) {}

  @Get('units')
  @Roles(...INVENTORY_READ_ROLES)
  async listUnits() {
    return {
      units: await this.inventoryService.listUnits(),
    };
  }

  @Get('raw-materials')
  @Roles(...INVENTORY_READ_ROLES)
  async listRawMaterials() {
    return {
      rawMaterials: await this.inventoryService.listRawMaterials(),
    };
  }

  @Post('raw-materials')
  @Roles(Role.ADMINISTRATOR)
  async createRawMaterial(@Body() dto: CreateRawMaterialDto) {
    return {
      rawMaterial: await this.inventoryService.createRawMaterial(dto),
    };
  }

  @Get('raw-materials/:id')
  @Roles(...INVENTORY_READ_ROLES)
  async getRawMaterial(@Param('id') rawMaterialId: string) {
    return {
      rawMaterial:
        await this.inventoryService.getRawMaterialById(rawMaterialId),
    };
  }

  @Patch('raw-materials/:id')
  @Roles(Role.ADMINISTRATOR)
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
  @Roles(Role.ADMINISTRATOR)
  async archiveRawMaterial(@Param('id') rawMaterialId: string) {
    return {
      rawMaterial:
        await this.inventoryService.archiveRawMaterial(rawMaterialId),
    };
  }

  @Get('raw-materials/:id/batches')
  @Roles(...INVENTORY_READ_ROLES)
  async listRawMaterialBatches(@Param('id') rawMaterialId: string) {
    return {
      batches:
        await this.inventoryService.listRawMaterialBatches(rawMaterialId),
    };
  }

  @Get('raw-materials/:id/transactions')
  @Roles(...INVENTORY_READ_ROLES)
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
  @Roles(...INVENTORY_READ_ROLES)
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
  @Roles(...INVENTORY_READ_ROLES)
  async listSuppliers() {
    return {
      suppliers: await this.inventoryService.listSuppliers(),
    };
  }

  @Post('suppliers')
  @Roles(Role.ADMINISTRATOR)
  async createSupplier(@Body() dto: CreateSupplierDto) {
    return {
      supplier: await this.inventoryService.createSupplier(dto),
    };
  }

  @Patch('suppliers/:id')
  @Roles(Role.ADMINISTRATOR)
  async updateSupplier(
    @Param('id') supplierId: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return {
      supplier: await this.inventoryService.updateSupplier(supplierId, dto),
    };
  }

  @Get('inventory/summary')
  @Roles(...INVENTORY_READ_ROLES)
  async listInventorySummary(@Query() filters: ListInventorySummaryDto) {
    return {
      summaries: await this.inventoryService.listInventorySummary(filters),
    };
  }

  @Get('inventory/transactions')
  @Roles(...INVENTORY_READ_ROLES)
  async listInventoryTransactions(
    @Query() filters: ListInventoryTransactionsDto,
  ) {
    return {
      transactions:
        await this.inventoryActionsService.listTransactions(filters),
    };
  }

  @Post('inventory/adjustments')
  @Roles(Role.ADMINISTRATOR, Role.STAFF)
  async createAdjustment(
    @Body() dto: CreateInventoryAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      transaction: await this.inventoryActionsService.createAdjustment(
        dto,
        user.id,
      ),
    };
  }

  @Post('inventory/waste')
  @Roles(Role.ADMINISTRATOR, Role.STAFF)
  async logWaste(
    @Body() dto: CreateInventoryWasteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      transaction: await this.inventoryActionsService.logWaste(dto, user.id),
    };
  }
}
