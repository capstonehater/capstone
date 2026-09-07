import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AvailabilityService } from '../availability/availability.service';
import {
  getManilaBusinessDateRange,
  getTodayManilaBusinessDateInput,
  parseBusinessDateToDateOnlyUtc,
} from '../common/utils/manila-business-date.util';
import { isBackgroundJobsEnabled } from '../config/env.validation';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

const SNAPSHOT_CHECK_INTERVAL_MS = 60 * 60 * 1000;

@Injectable()
export class InventoryDailySnapshotService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(InventoryDailySnapshotService.name);
  private snapshotTimer?: NodeJS.Timeout;
  private snapshotInFlight = false;
  private lastExpiryRefreshBusinessDate?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly availabilityService: AvailabilityService,
  ) {}

  onModuleInit() {
    if (!isBackgroundJobsEnabled()) {
      this.logger.log(
        'Background inventory snapshot jobs are disabled for this runtime.',
      );
      return;
    }

    if (this.snapshotTimer) {
      return;
    }

    this.snapshotTimer = setInterval(() => {
      void this.captureTodayIfMissing();
    }, SNAPSHOT_CHECK_INTERVAL_MS);

    void this.captureTodayIfMissing();
  }

  onModuleDestroy() {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
  }

  async captureTodayIfMissing() {
    if (this.snapshotInFlight) {
      return;
    }

    this.snapshotInFlight = true;
    try {
      const snapshotDate = getTodayManilaBusinessDateInput();
      await this.captureSnapshotIfMissing(snapshotDate);
    } catch (error) {
      this.logger.error(
        'Failed to capture daily inventory snapshots',
        error as Error,
      );
    } finally {
      this.snapshotInFlight = false;
    }
  }

  async captureSnapshotIfMissing(snapshotDateInput: string) {
    await this.refreshExpirySensitiveSummariesIfNeeded(snapshotDateInput);

    const snapshotDate = parseBusinessDateToDateOnlyUtc(snapshotDateInput);
    const existingCount = await this.prisma.inventoryDailySnapshot.count({
      where: {
        snapshotDate,
      },
    });

    if (existingCount > 0) {
      return;
    }

    const summaries = await this.inventoryService.listInventorySummary({
      includeArchived: 'true',
    });

    if (summaries.length === 0) {
      return;
    }

    await this.prisma.inventoryDailySnapshot.createMany({
      data: summaries.map((summary) => ({
        snapshotDate,
        rawMaterialId: summary.rawMaterialId,
        onHandQuantity: this.toDecimal(summary.summary.onHandQuantity),
        usableQuantity: this.toDecimal(summary.summary.usableQuantity),
        inventoryValue: this.toDecimal(summary.inventoryValue),
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Captured ${summaries.length} inventory daily snapshots for ${snapshotDateInput}`,
    );
  }

  private async refreshExpirySensitiveSummariesIfNeeded(
    snapshotDateInput: string,
  ) {
    if (this.lastExpiryRefreshBusinessDate === snapshotDateInput) {
      return;
    }

    const refreshBoundary = getManilaBusinessDateRange(snapshotDateInput).from;
    const rawMaterialIds =
      await this.availabilityService.findRawMaterialIdsWithExpiredStock(
        this.prisma,
        refreshBoundary,
      );

    if (rawMaterialIds.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await this.availabilityService.refreshRawMaterialSummaries(
          tx,
          rawMaterialIds,
          refreshBoundary,
        );
        await this.availabilityService.refreshVariantSummariesForRawMaterialIds(
          tx,
          rawMaterialIds,
          refreshBoundary,
        );
      });

      this.logger.log(
        `Refreshed ${rawMaterialIds.length} expiry-sensitive inventory summaries for ${snapshotDateInput}`,
      );
    }

    this.lastExpiryRefreshBusinessDate = snapshotDateInput;
  }

  private toDecimal(value: Prisma.Decimal | string | number) {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }
}
