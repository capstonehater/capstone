import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toDecimal } from '../common/utils/decimal.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListInventorySummaryDto } from './dto/list-inventory-summary.dto';
import { UpdateRawMaterialDto } from './dto/update-raw-material.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

const ZERO = new Prisma.Decimal(0);

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureCategoriesExist(categoryIds?: string[]) {
    if (!categoryIds?.length) return;
    const count = await this.prisma.category.count({ where: { id: { in: categoryIds } } });
    if (count !== new Set(categoryIds).size) {
      throw new BadRequestException('One or more product categories do not exist.');
    }
  }

  async createUnit(dto: CreateUnitDto) {
    const name = dto.name.trim();
    const code = dto.code.trim().toUpperCase();
    if (!name || !code) throw new BadRequestException('Unit name and abbreviation are required.');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(614210)::text`;
      const existing = await tx.unit.findFirst({
        where: { OR: [
          { name: { equals: name, mode: 'insensitive' } },
          { code: { equals: code, mode: 'insensitive' } },
        ] },
      });
      if (existing) throw new ConflictException('A unit with this name or abbreviation already exists. Select the existing unit.');
      return tx.unit.create({ data: { name, code, dimension: dto.dimension, conversionFactor: toDecimal(1) } });
    });
  }

  async createUnitForMaterial(rawMaterialId: string, dto: CreateUnitDto) {
    await this.ensureRawMaterialExists(rawMaterialId);
    return this.createUnit(dto);
  }

  async listUnits() {
    return this.prisma.unit.findMany({
      orderBy: [{ dimension: 'asc' }, { name: 'asc' }],
    });
  }

  async createRawMaterial(dto: CreateRawMaterialDto) {
    await this.ensureUnitExists(dto.unitId);
    await this.ensureCategoriesExist(dto.categoryIds);

    const rawMaterial = await this.prisma.rawMaterial.create({
      data: {
        name: dto.name,
        sku: dto.sku,
        unitId: dto.unitId,
        reorderPoint: toDecimal(dto.reorderPoint ?? 0),
        categories: { connect: (dto.categoryIds ?? []).map((id) => ({ id })) },
      },
      include: {
        unit: true,
        summary: true,
        categories: { select: { id: true, name: true } },
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
    await this.ensureCategoriesExist(dto.categoryIds);
    if (dto.categoryIds !== undefined) {
      const disallowedCategory = { categoryId: { notIn: dto.categoryIds } };
      const [recipe, modifier] = await Promise.all([
        this.prisma.variantRecipeItem.findFirst({
          where: { rawMaterialId, productVariant: { product: disallowedCategory } },
          select: { productVariant: { select: { product: { select: { name: true, category: { select: { name: true } } } } } } },
        }),
        this.prisma.productModifierGroup.findFirst({
          where: { product: disallowedCategory, modifierGroup: { modifiers: { some: { recipeAdjustments: { some: { rawMaterialId } } } } } },
          select: { product: { select: { name: true, category: { select: { name: true } } } } },
        }),
      ]);
      const conflict = recipe?.productVariant.product ?? modifier?.product;
      if (conflict) {
        throw new BadRequestException(`${conflict.name} already uses this material in ${conflict.category.name}. Keep that category selected or remove the material from the product's recipe first.`);
      }
    }

    if (dto.unitId) {
      await this.ensureUnitExists(dto.unitId);
    }

    return this.prisma.rawMaterial.update({
      where: { id: rawMaterialId },
      data: {
        name: dto.name,
        sku: dto.sku,
        unitId: dto.unitId,
        categories: dto.categoryIds !== undefined
          ? { set: dto.categoryIds.map((id) => ({ id })) }
          : undefined,
        reorderPoint:
          dto.reorderPoint !== undefined
            ? toDecimal(dto.reorderPoint)
            : undefined,
      },
      include: {
        unit: true,
        summary: true,
        categories: { select: { id: true, name: true } },
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
        categories: { select: { id: true, name: true } },
      },
    });
  }

  async unarchiveRawMaterial(rawMaterialId: string) {
    await this.ensureRawMaterialExists(rawMaterialId);
    return this.prisma.rawMaterial.update({
      where: { id: rawMaterialId },
      data: { isActive: true },
      include: { unit: true, summary: true },
    });
  }

  async deleteRawMaterial(rawMaterialId: string) {
    return this.prisma.$transaction(async (tx) => {
      const material = await tx.rawMaterial.findUnique({
        where: { id: rawMaterialId },
        include: { unit: true },
      });
      if (!material) throw new NotFoundException('Raw material not found');
      const [recipes, modifiers, drafts] = await Promise.all([
        tx.variantRecipeItem.count({ where: { rawMaterialId } }),
        tx.modifierRecipeAdjustment.count({ where: { rawMaterialId } }),
        tx.stockRunItem.count({ where: { rawMaterialId, stockRun: { status: 'DRAFT' } } }),
      ]);
      if (recipes || modifiers || drafts) {
        throw new BadRequestException('Remove this material from product recipes, modifier recipes, and draft stock runs before deleting it.');
      }
      const snapshot = JSON.parse(JSON.stringify(material)) as Prisma.InputJsonObject;
      const update = { where: { rawMaterialId }, data: { rawMaterialSnapshot: snapshot } };
      await tx.stockRunItem.updateMany(update);
      await tx.stockBatch.updateMany(update);
      await tx.inventoryTransactionLine.updateMany(update);
      await tx.inventoryDailySnapshot.updateMany(update);
      await tx.storeAvailabilitySearch.updateMany(update);
      await tx.alert.updateMany(update);
      await tx.stockoutEvent.updateMany(update);
      await tx.alert.updateMany({ where: { rawMaterialId, state: 'ACTIVE' }, data: { state: 'RESOLVED', resolvedAt: new Date() } });
      await tx.stockoutEvent.updateMany({ where: { rawMaterialId, endedAt: null }, data: { endedAt: new Date() } });
      await tx.rawMaterial.delete({ where: { id: rawMaterialId } });
      return { id: material.id, name: material.name };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async listRawMaterials() {
    return this.prisma.rawMaterial.findMany({
      orderBy: { name: 'asc' },
      include: {
        unit: true,
        summary: true,
        categories: { select: { id: true, name: true } },
      },
    });
  }

  async getRawMaterialById(rawMaterialId: string) {
    const rawMaterial = await this.prisma.rawMaterial.findUnique({
      where: { id: rawMaterialId },
      include: {
        unit: true,
        summary: true,
        categories: { select: { id: true, name: true } },
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
        isActive:
          filters.status === 'INACTIVE' ? false : includeArchived ? undefined : true,
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
        categories: { select: { id: true, name: true } },
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
          categories: rawMaterial.categories,
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
