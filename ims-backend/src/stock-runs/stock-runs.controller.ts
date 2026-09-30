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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateStockRunDto } from './dto/create-stock-run.dto';
import { CreateStockRunItemDto } from './dto/create-stock-run-item.dto';
import { ListStockRunsDto } from './dto/list-stock-runs.dto';
import { UpdateStockRunDto } from './dto/update-stock-run.dto';
import { StockRunsService } from './stock-runs.service';

@Controller('stock-runs')
export class StockRunsController {
  constructor(private readonly stockRunsService: StockRunsService) {}

  @Post()
  @RequirePermission('stockRuns.create')
  async createStockRun(
    @Body() dto: CreateStockRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      stockRun: await this.stockRunsService.createStockRun(dto, user.id),
    };
  }

  @Patch(':id')
  @RequirePermission('stockRuns.edit')
  async updateStockRun(
    @Param('id') stockRunId: string,
    @Body() dto: UpdateStockRunDto,
  ) {
    return {
      stockRun: await this.stockRunsService.updateStockRun(stockRunId, dto),
    };
  }

  @Post(':id/items')
  @RequirePermission('stockRuns.edit')
  async addStockRunItem(
    @Param('id') stockRunId: string,
    @Body() dto: CreateStockRunItemDto,
  ) {
    return {
      stockRunItem: await this.stockRunsService.addStockRunItem(
        stockRunId,
        dto,
      ),
    };
  }

  @Delete(':id/items/:itemId')
  @RequirePermission('stockRuns.edit')
  async deleteStockRunItem(
    @Param('id') stockRunId: string,
    @Param('itemId') stockRunItemId: string,
  ) {
    await this.stockRunsService.deleteStockRunItem(stockRunId, stockRunItemId);
    return { deleted: true };
  }

  @Post('drafts/:id/delete')
  @RequirePermission('stockRuns.delete')
  async removeStockRunDraft(@Param('id') stockRunId: string) {
    await this.stockRunsService.deleteDraftStockRun(stockRunId);
    return { deleted: true };
  }

  @Delete(':id/draft')
  @RequirePermission('stockRuns.delete')
  async deleteStockRunDraft(@Param('id') stockRunId: string) {
    await this.stockRunsService.deleteDraftStockRun(stockRunId);
    return { deleted: true };
  }

  @Delete(':id')
  @RequirePermission('stockRuns.delete')
  async deleteStockRun(@Param('id') stockRunId: string) {
    await this.stockRunsService.deleteDraftStockRun(stockRunId);
    return { deleted: true };
  }

  @Post(':id/post')
  @RequirePermission('stockRuns.post')
  async postStockRun(
    @Param('id') stockRunId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      stockRun: await this.stockRunsService.postStockRun(stockRunId, user.id),
    };
  }

  @Get()
  @RequirePermission('stockRuns.view')
  async listStockRuns(@Query() filters: ListStockRunsDto) {
    return {
      stockRuns: await this.stockRunsService.listStockRuns(filters),
    };
  }

  @Get(':id')
  @RequirePermission('stockRuns.view')
  async getStockRun(@Param('id') stockRunId: string) {
    return {
      stockRun: await this.stockRunsService.getStockRunById(stockRunId),
    };
  }
}
