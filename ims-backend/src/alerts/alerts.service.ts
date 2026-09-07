import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AlertSeverity, AlertState, AlertType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAlertsDto } from './dto/list-alerts.dto';

const ZERO = new Prisma.Decimal(0);
const NEAR_EXPIRY_THRESHOLD_DAYS = 14;
const READ_ALERT_RETENTION_DAYS = 30;
const READ_ALERT_STATES: AlertState[] = [
  AlertState.ACKNOWLEDGED,
  AlertState.DISMISSED,
  AlertState.RESOLVED,
];

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listAlerts(filters: ListAlertsDto = {}) {
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 200);
    const search = filters.search?.trim();
    const readVisibilityCutoff = this.getReadVisibilityCutoff();
    const where = this.buildListAlertsWhere(
      filters,
      search,
      readVisibilityCutoff,
    );

    const alerts = await this.prisma.alert.findMany({
      where,
      orderBy: [{ lastTriggeredAt: 'desc' }],
      include: {
        rawMaterial: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        stockBatch: {
          select: {
            id: true,
            expirationDate: true,
            remainingQuantity: true,
            costPerUnit: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        acknowledgedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        dismissedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return alerts
      .sort((left, right) => this.compareAlerts(left, right))
      .slice(0, limit);
  }

  async getUnreadCount() {
    const count = await this.prisma.alert.count({
      where: {
        state: AlertState.ACTIVE,
      },
    });

    return { count };
  }

  async acknowledgeAlert(alertId: string, userId: string, note?: string) {
    const alert = await this.getAlertForStateTransition(alertId);

    if (alert.state === AlertState.RESOLVED) {
      throw new BadRequestException(
        'Resolved alerts can no longer be marked as read.',
      );
    }

    if (alert.state === AlertState.ACKNOWLEDGED) {
      return this.getAlertWithRelations(alertId);
    }

    return this.prisma.alert.update({
      where: { id: alertId },
      data: {
        state: AlertState.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedByUserId: userId,
        dismissedAt: null,
        dismissedByUserId: null,
        resolvedAt: null,
        metadata:
          note !== undefined
            ? {
                note,
              }
            : undefined,
      },
      include: {
        rawMaterial: true,
        stockBatch: true,
        supplier: true,
      },
    });
  }

  async dismissAlert(alertId: string, userId: string, note?: string) {
    const alert = await this.getAlertForStateTransition(alertId);

    if (alert.state !== AlertState.ACTIVE) {
      throw new BadRequestException('Only unread alerts can be dismissed.');
    }

    return this.prisma.alert.update({
      where: { id: alertId },
      data: {
        state: AlertState.DISMISSED,
        dismissedAt: new Date(),
        dismissedByUserId: userId,
        acknowledgedAt: null,
        acknowledgedByUserId: null,
        resolvedAt: null,
        metadata:
          note !== undefined
            ? {
                note,
              }
            : undefined,
      },
      include: {
        rawMaterial: true,
        stockBatch: true,
        supplier: true,
      },
    });
  }

  async reevaluateAllOperationalAlerts() {
    const rawMaterials = await this.prisma.rawMaterial.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (rawMaterials.length === 0) {
      return;
    }

    await this.syncOperationalAlertsForRawMaterialIds(
      rawMaterials.map((rawMaterial) => rawMaterial.id),
    );
  }

  async syncOperationalAlertsForRawMaterialIds(rawMaterialIds: string[]) {
    const uniqueRawMaterialIds = [...new Set(rawMaterialIds)].filter(Boolean);

    if (uniqueRawMaterialIds.length === 0) {
      return;
    }

    const today = this.startOfToday();
    const nearExpiryCutoff = new Date(today);
    nearExpiryCutoff.setDate(
      nearExpiryCutoff.getDate() + NEAR_EXPIRY_THRESHOLD_DAYS,
    );

    const materials = await this.prisma.rawMaterial.findMany({
      where: {
        id: {
          in: uniqueRawMaterialIds,
        },
      },
      include: {
        summary: true,
        stockBatches: {
          where: {
            remainingQuantity: {
              gt: ZERO,
            },
          },
          include: {
            supplier: true,
          },
          orderBy: [{ expirationDate: 'asc' }, { receivedAt: 'asc' }],
        },
      },
    });

    for (const material of materials) {
      const usableQuantity = material.summary?.usableQuantity ?? ZERO;
      const reorderPoint = material.reorderPoint ?? ZERO;
      const lowStockIsActive = material.isActive
        ? usableQuantity.lessThanOrEqualTo(reorderPoint)
        : false;

      await this.upsertOperationalAlert({
        dedupeKey: `LOW_STOCK:${material.id}`,
        type: AlertType.LOW_STOCK,
        stateWhenActive: AlertState.ACTIVE,
        isActive: lowStockIsActive,
        severity: usableQuantity.lessThanOrEqualTo(0)
          ? AlertSeverity.CRITICAL
          : AlertSeverity.WARNING,
        title: `${material.name} is running low`,
        message: `Usable quantity is ${usableQuantity.toString()} with a reorder point of ${reorderPoint.toString()}.`,
        rawMaterialId: material.id,
        remainingQuantity: usableQuantity,
        metadata: {
          thresholdDays: NEAR_EXPIRY_THRESHOLD_DAYS,
          reorderPoint: reorderPoint.toString(),
          usableQuantity: usableQuantity.toString(),
        },
      });

      const activeExpiryKeys = new Set<string>();

      for (const batch of material.stockBatches) {
        if (!batch.expirationDate) {
          continue;
        }

        const isExpired = batch.expirationDate < today;
        const isNearExpiry =
          !isExpired && batch.expirationDate <= nearExpiryCutoff;

        if (!isExpired && !isNearExpiry) {
          continue;
        }

        const type = isExpired ? AlertType.EXPIRED : AlertType.NEAR_EXPIRY;
        const dedupeKey = `${type}:${batch.id}`;
        activeExpiryKeys.add(dedupeKey);

        await this.upsertOperationalAlert({
          dedupeKey,
          type,
          stateWhenActive: AlertState.ACTIVE,
          isActive: true,
          severity: isExpired ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          title: isExpired
            ? `${material.name} batch has expired`
            : `${material.name} batch is nearing expiry`,
          message: isExpired
            ? `Batch ${batch.id.slice(0, 8)} expired on ${batch.expirationDate.toISOString().slice(0, 10)} with ${batch.remainingQuantity.toString()} remaining.`
            : `Batch ${batch.id.slice(0, 8)} expires on ${batch.expirationDate.toISOString().slice(0, 10)} with ${batch.remainingQuantity.toString()} remaining.`,
          rawMaterialId: material.id,
          stockBatchId: batch.id,
          supplierId: batch.supplierId ?? null,
          expiryDate: batch.expirationDate,
          remainingQuantity: batch.remainingQuantity,
          metadata: {
            supplierName: batch.supplier?.name ?? null,
            thresholdDays: NEAR_EXPIRY_THRESHOLD_DAYS,
          },
        });
      }

      const staleExpiryAlerts = await this.prisma.alert.findMany({
        where: {
          rawMaterialId: material.id,
          type: {
            in: [AlertType.NEAR_EXPIRY, AlertType.EXPIRED],
          },
          state: {
            in: [AlertState.ACTIVE, AlertState.ACKNOWLEDGED],
          },
        },
        select: {
          id: true,
          dedupeKey: true,
        },
      });

      for (const alert of staleExpiryAlerts) {
        if (!activeExpiryKeys.has(alert.dedupeKey)) {
          await this.resolveAlert(alert.id);
        }
      }
    }
  }

  private async upsertOperationalAlert(input: {
    dedupeKey: string;
    type: AlertType;
    stateWhenActive: AlertState;
    isActive: boolean;
    severity: AlertSeverity;
    title: string;
    message: string;
    rawMaterialId?: string | null;
    stockBatchId?: string | null;
    supplierId?: string | null;
    expiryDate?: Date | null;
    remainingQuantity?: Prisma.Decimal | null;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    const existing = await this.prisma.alert.findUnique({
      where: {
        dedupeKey: input.dedupeKey,
      },
    });

    if (!input.isActive) {
      if (existing && existing.state !== AlertState.RESOLVED) {
        await this.resolveAlert(existing.id);
      }

      return;
    }

    const createData: Prisma.AlertUncheckedCreateInput = {
      dedupeKey: input.dedupeKey,
      type: input.type,
      severity: input.severity,
      state: input.stateWhenActive,
      title: input.title,
      message: input.message,
      rawMaterialId: input.rawMaterialId ?? null,
      stockBatchId: input.stockBatchId ?? null,
      supplierId: input.supplierId ?? null,
      expiryDate: input.expiryDate ?? null,
      remainingQuantity: input.remainingQuantity ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
      lastTriggeredAt: new Date(),
    };

    const updateData: Prisma.AlertUncheckedUpdateInput = {
      type: input.type,
      severity: input.severity,
      title: input.title,
      message: input.message,
      rawMaterialId: input.rawMaterialId ?? null,
      stockBatchId: input.stockBatchId ?? null,
      supplierId: input.supplierId ?? null,
      expiryDate: input.expiryDate ?? null,
      remainingQuantity: input.remainingQuantity ?? null,
      metadata: input.metadata ?? Prisma.JsonNull,
      lastTriggeredAt: new Date(),
    };

    if (!existing) {
      await this.prisma.alert.create({
        data: createData,
      });
      return;
    }

    await this.prisma.alert.update({
      where: { id: existing.id },
      data: {
        ...updateData,
        ...this.getOperationalAlertStateUpdate(
          existing.state,
          input.stateWhenActive,
        ),
      },
    });
  }

  private async resolveAlert(alertId: string) {
    await this.prisma.alert.update({
      where: { id: alertId },
      data: {
        state: AlertState.RESOLVED,
        resolvedAt: new Date(),
      },
    });
  }

  private async getAlertForStateTransition(alertId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { id: alertId },
      select: {
        id: true,
        state: true,
      },
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  private getAlertWithRelations(alertId: string) {
    return this.prisma.alert.findUniqueOrThrow({
      where: { id: alertId },
      include: {
        rawMaterial: true,
        stockBatch: true,
        supplier: true,
      },
    });
  }

  private buildListAlertsWhere(
    filters: ListAlertsDto,
    search: string | undefined,
    readVisibilityCutoff: Date,
  ): Prisma.AlertWhereInput {
    const conditions: Prisma.AlertWhereInput[] = [];

    conditions.push(
      filters.state
        ? this.buildStateVisibilityWhere(filters.state, readVisibilityCutoff)
        : {
            OR: [
              { state: AlertState.ACTIVE },
              {
                state: {
                  in: READ_ALERT_STATES,
                },
                lastTriggeredAt: {
                  gte: readVisibilityCutoff,
                },
              },
            ],
          },
    );

    if (filters.type) {
      conditions.push({ type: filters.type });
    }

    if (filters.severity) {
      conditions.push({ severity: filters.severity });
    }

    if (filters.rawMaterialId) {
      conditions.push({ rawMaterialId: filters.rawMaterialId });
    }

    if (filters.stockBatchId) {
      conditions.push({ stockBatchId: filters.stockBatchId });
    }

    if (search) {
      conditions.push({
        OR: [
          {
            title: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            message: {
              contains: search,
              mode: 'insensitive',
            },
          },
          {
            rawMaterial: {
              is: {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
          {
            supplier: {
              is: {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            },
          },
        ],
      });
    }

    return conditions.length === 1 ? conditions[0] : { AND: conditions };
  }

  private buildStateVisibilityWhere(
    state: AlertState,
    readVisibilityCutoff: Date,
  ): Prisma.AlertWhereInput {
    if (state === AlertState.ACTIVE) {
      return { state };
    }

    return {
      state,
      lastTriggeredAt: {
        gte: readVisibilityCutoff,
      },
    };
  }

  private compareAlerts(
    left: {
      state: AlertState;
      severity: AlertSeverity;
      lastTriggeredAt: Date;
      id: string;
    },
    right: {
      state: AlertState;
      severity: AlertSeverity;
      lastTriggeredAt: Date;
      id: string;
    },
  ) {
    const unreadDiff =
      this.getAlertReadPriority(left.state) -
      this.getAlertReadPriority(right.state);

    if (unreadDiff !== 0) {
      return unreadDiff;
    }

    const triggeredDiff =
      right.lastTriggeredAt.getTime() - left.lastTriggeredAt.getTime();

    if (triggeredDiff !== 0) {
      return triggeredDiff;
    }

    const severityDiff =
      this.getAlertSeverityPriority(left.severity) -
      this.getAlertSeverityPriority(right.severity);

    if (severityDiff !== 0) {
      return severityDiff;
    }

    return left.id.localeCompare(right.id);
  }

  private getAlertReadPriority(state: AlertState) {
    return state === AlertState.ACTIVE ? 0 : 1;
  }

  private getAlertSeverityPriority(severity: AlertSeverity) {
    if (severity === AlertSeverity.CRITICAL) {
      return 0;
    }

    if (severity === AlertSeverity.WARNING) {
      return 1;
    }

    return 2;
  }

  private getOperationalAlertStateUpdate(
    existingState: AlertState,
    stateWhenActive: AlertState,
  ): Prisma.AlertUncheckedUpdateInput {
    if (existingState === AlertState.ACKNOWLEDGED) {
      return {
        state: AlertState.ACKNOWLEDGED,
        dismissedAt: null,
        dismissedByUserId: null,
        resolvedAt: null,
      };
    }

    if (existingState === AlertState.DISMISSED) {
      return {
        state: AlertState.DISMISSED,
        acknowledgedAt: null,
        acknowledgedByUserId: null,
        resolvedAt: null,
      };
    }

    return {
      state: stateWhenActive,
      acknowledgedAt: null,
      acknowledgedByUserId: null,
      dismissedAt: null,
      dismissedByUserId: null,
      resolvedAt: null,
    };
  }

  private getReadVisibilityCutoff() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - READ_ALERT_RETENTION_DAYS);
    return cutoff;
  }

  private startOfToday() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }
}
