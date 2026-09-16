import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toDecimal } from '../common/utils/decimal.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListInventorySummaryDto } from './dto/list-inventory-summary.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listUnits() {
    return this.prisma.unit.findMany({
      orderBy: [{ dimension: 'asc' }, { name: 'asc' }],
    });
  }

  async createRawMaterial(dto: CreateRawMaterialDto) {
    await this.ensureUnitExists(dto.unitId);

    const rawMaterial = await this.prisma.rawMaterial.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        unitId: dto.unitId,
        reorderPoint: toDecimal(dto.reorderPoint ?? 0),
      },
      include: {
        unit: true,
        summary: true,
      },
    });

    await this.prisma.rawMaterialInventorySummary.upsert({
      where: { rawMaterialId: rawMaterial.id },
      update: {},
      create: {
        rawMaterialId: rawMaterial.id,
        onHandQuantity: ZERO,
        usableQuantity: ZERO,
        activeBatchCount: 0,
      },
    });

    return this.getRawMaterialById(rawMaterial.id);
  }

  async updateRawMaterial(rawMaterialId: string, dto: UpdateRawMaterialDto) {
    await this.ensureRawMaterialExists(rawMaterialId);

    if (dto.unitId) {
      await this.ensureUnitExists(dto.unitId);
    }

    return this.prisma.rawMaterial.update({
      where: { id: rawMaterialId },
      data: {
        name: dto.name,
        sku: dto.sku,
        unitId: dto.unitId,
        reorderPoint:
          dto.reorderPoint !== undefined
            ? toDecimal(dto.reorderPoint)
            : undefined,
      },
      include: {
        unit: true,
        summary: true,
      },
    });
  }

  async archiveRawMaterial(rawMaterialId: string) {
    await this.ensureRawMaterialExists(rawMaterialId);

    return this.prisma.rawMaterial.update({
      where: { id: rawMaterialId },
      data: {
        isActive: false,
      },
      include: {
        unit: true,
        summary: true,
      },
    });
  }

  async listRawMaterials() {
    return this.prisma.rawMaterial.findMany({
      orderBy: { name: 'asc' },
      include: {
        unit: true,
        summary: true,
      },
    });
  }

  async getRawMaterialById(rawMaterialId: string) {
    const rawMaterial = await this.prisma.rawMaterial.findUnique({
      where: { id: rawMaterialId },
      include: {
        unit: true,
        summary: true,
      },
    });

    if (!rawMaterial) {
      throw new NotFoundException('Raw material not found');
    }

    return rawMaterial;
  }

  async listRawMaterialBatches(rawMaterialId: string) {
    await this.ensureRawMaterialExists(rawMaterialId);

    return this.prisma.stockBatch.findMany({
      where: { rawMaterialId },
      orderBy: [{ expirationDate: 'asc' }, { receivedAt: 'asc' }],
      include: {
        supplier: true,
        stockRunItem: {
          include: {
            stockRun: true,
          },
        },
      },
    });
  }

  async createSupplier(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        latitude:
          dto.latitude !== undefined ? toDecimal(dto.latitude) : undefined,
        longitude:
          dto.longitude !== undefined ? toDecimal(dto.longitude) : undefined,
        address: dto.address ?? null,
        contactInfo: dto.contactInfo ?? null,
      },
    });
  }

  async updateSupplier(supplierId: string, dto: UpdateSupplierDto) {
    await this.ensureSupplierExists(supplierId);

    return this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        name: dto.name,
        latitude:
          dto.latitude !== undefined ? toDecimal(dto.latitude) : undefined,
        longitude:
          dto.longitude !== undefined ? toDecimal(dto.longitude) : undefined,
        address: dto.address ?? undefined,
        contactInfo: dto.contactInfo ?? undefined,
      },
    });
  }

  async deleteSupplier(supplierId: string) {
    try {
      // Existing foreign keys use SetNull to retain stock and purchasing history.
      return await this.prisma.supplier.delete({ where: { id: supplierId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Supplier not found');
      }
      throw error;
    }
  }

  async listSuppliers() {
    return this.prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async listInventorySummary(filters: ListInventorySummaryDto) {
    const includeArchived = filters.includeArchived === 'true';
    const search = filters.search?.trim();

    const rawMaterials = await this.prisma.rawMaterial.findMany({
      where: {
        isActive: includeArchived ? undefined : true,
        OR: search
          ? [
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                sku: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ]
          : undefined,
        stockBatches: filters.supplierId
          ? {
              some: {
                supplierId: filters.supplierId,
              },
            }
          : undefined,
      },
      orderBy: { name: 'asc' },
      include: {
        unit: true,
        summary: true,
        stockBatches: {
          select: {
            remainingQuantity: true,
            costPerUnit: true,
            supplierId: true,
          },
        },
      },
    });

    return rawMaterials
      .map((rawMaterial) => {
        const summary = rawMaterial.summary ?? {
          onHandQuantity: ZERO,
          usableQuantity: ZERO,
          nearestExpiryDate: null,
          activeBatchCount: 0,
          updatedAt: rawMaterial.updatedAt,
        };

        const inventoryValue = rawMaterial.stockBatches.reduce(
          (total, batch) =>
            total.plus(batch.remainingQuantity.mul(batch.costPerUnit)),
          ZERO,
        );

        const status = !rawMaterial.isActive
          ? 'INACTIVE'
          : summary.usableQuantity.lessThanOrEqualTo(0)
            ? 'OUT_OF_STOCK'
            : summary.usableQuantity.lessThanOrEqualTo(rawMaterial.reorderPoint)
              ? 'LOW_STOCK'
              : 'IN_STOCK';

        return {
          rawMaterialId: rawMaterial.id,
          name: rawMaterial.name,
          sku: rawMaterial.sku,
          reorderPoint: rawMaterial.reorderPoint,
          isActive: rawMaterial.isActive,
          unit: rawMaterial.unit,
          summary,
          inventoryValue,
          status,
        };
      })
      .filter((item) => {
        if (!filters.status) {
          return true;
        }

        return item.status === filters.status;
      });
  }

  private async ensureRawMaterialExists(rawMaterialId: string) {
    const exists = await this.prisma.rawMaterial.findUnique({
      where: { id: rawMaterialId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException('Raw material not found');
    }
  }

  private async ensureUnitExists(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { id: true },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }
  }

  private async ensureSupplierExists(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
  }
}
