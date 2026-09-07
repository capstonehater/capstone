import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum ProductManualAvailabilityFilter {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

export enum ProductArchiveStateFilter {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
  ALL = 'ALL',
}

export enum ProductEffectiveStatusFilter {
  SELLABLE = 'SELLABLE',
  PARTIALLY_AVAILABLE = 'PARTIALLY_AVAILABLE',
  MANUALLY_DISABLED = 'MANUALLY_DISABLED',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
  NO_VALID_RECIPE = 'NO_VALID_RECIPE',
  NO_SELLABLE_VARIANT = 'NO_SELLABLE_VARIANT',
  ARCHIVED = 'ARCHIVED',
}

export enum ProductListSortBy {
  NAME = 'name',
  CATEGORY = 'category',
  VARIANT_COUNT = 'variantCount',
  INGREDIENT_COUNT = 'ingredientCount',
  UPDATED_AT = 'updatedAt',
}

export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListAdminProductsDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ProductManualAvailabilityFilter)
  manualAvailability?: ProductManualAvailabilityFilter;

  @IsOptional()
  @IsEnum(ProductEffectiveStatusFilter)
  effectiveStatus?: ProductEffectiveStatusFilter;

  @IsOptional()
  @IsEnum(ProductArchiveStateFilter)
  archiveState?: ProductArchiveStateFilter;

  @IsOptional()
  @IsEnum(ProductListSortBy)
  sortBy?: ProductListSortBy;

  @IsOptional()
  @IsEnum(SortDirection)
  sortDirection?: SortDirection;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
