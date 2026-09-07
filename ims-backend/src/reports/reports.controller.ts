import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { PosAuditExceptionsDto } from './dto/pos-audit-exceptions.dto';
import { PosInventoryLinkedDto } from './dto/pos-inventory-linked.dto';
import { PosPeakHoursDto } from './dto/pos-peak-hours.dto';
import { PosProductPerformanceDto } from './dto/pos-product-performance.dto';
import { PosRefundsVoidsDto } from './dto/pos-refunds-voids.dto';
import { PosSalesAnalyticsDto } from './dto/pos-sales-analytics.dto';
import { PosTransactionHistoryDto } from './dto/pos-transaction-history.dto';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
@Roles(Role.ADMINISTRATOR)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales-overview')
  async getSalesOverview(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getSalesOverview(filters),
    };
  }

  @Get('variant-margin')
  async getVariantMargin(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getVariantMargin(filters),
    };
  }

  @Get('waste-summary')
  async getWasteSummary(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getWasteSummary(filters),
    };
  }

  @Get('stock-run-spend')
  async getStockRunSpend(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getStockRunSpend(filters),
    };
  }

  @Get('inventory-health')
  async getInventoryHealth(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getInventoryHealth(filters),
    };
  }

  @Get('inventory-kpi-summary')
  async getInventoryKpiSummary(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getInventoryKpiSummary(filters),
    };
  }

  @Get('inventory-availability-risk')
  async getInventoryAvailabilityRisk(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getInventoryAvailabilityRisk(filters),
    };
  }

  @Get('pos-dashboard')
  async getPosDashboard(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getPosDashboard(filters),
    };
  }

  @Get('pos-transaction-history')
  async getPosTransactionHistory(@Query() filters: PosTransactionHistoryDto) {
    return {
      report: await this.reportsService.getPosTransactionHistory(filters),
    };
  }

  @Get('pos-sales-analytics')
  async getPosSalesAnalytics(@Query() filters: PosSalesAnalyticsDto) {
    return {
      report: await this.reportsService.getPosSalesAnalytics(filters),
    };
  }

  @Get('pos-payment-reports')
  async getPosPaymentReports(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getPosPaymentReports(filters),
    };
  }

  @Get('pos-refunds-voids')
  async getPosRefundsVoids(@Query() filters: PosRefundsVoidsDto) {
    return {
      report: await this.reportsService.getPosRefundsVoids(filters),
    };
  }

  @Get('pos-product-performance')
  async getPosProductPerformance(@Query() filters: PosProductPerformanceDto) {
    return {
      report: await this.reportsService.getPosProductPerformance(filters),
    };
  }

  @Get('pos-staff-performance')
  async getPosStaffPerformance(@Query() filters: ReportFiltersDto) {
    return {
      report: await this.reportsService.getPosStaffPerformance(filters),
    };
  }

  @Get('pos-peak-hours')
  async getPosPeakHours(@Query() filters: PosPeakHoursDto) {
    return {
      report: await this.reportsService.getPosPeakHours(filters),
    };
  }

  @Get('pos-inventory-linked')
  async getPosInventoryLinked(@Query() filters: PosInventoryLinkedDto) {
    return {
      report: await this.reportsService.getPosInventoryLinked(filters),
    };
  }

  @Get('pos-audit-exceptions')
  async getPosAuditExceptions(@Query() filters: PosAuditExceptionsDto) {
    return {
      report: await this.reportsService.getPosAuditExceptions(filters),
    };
  }
}
