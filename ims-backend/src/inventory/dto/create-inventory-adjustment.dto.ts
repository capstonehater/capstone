import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export enum InventoryAdjustmentDirection {
  INCREASE = 'INCREASE',
  DECREASE = 'DECREASE',
}

export class CreateInventoryAdjustmentDto {
  @IsEnum(InventoryAdjustmentDirection)
  direction!: InventoryAdjustmentDirection;

  @IsString()
  rawMaterialId!: string;

  @ValidateIf(
    (dto: CreateInventoryAdjustmentDto) =>
      dto.direction === InventoryAdjustmentDirection.DECREASE,
  )
  @IsString()
  batchId?: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsString()
  @MaxLength(80)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ValidateIf(
    (dto: CreateInventoryAdjustmentDto) =>
      dto.direction === InventoryAdjustmentDirection.INCREASE,
  )
  @IsNumber()
  @IsPositive()
  costPerUnit?: number;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;
}
