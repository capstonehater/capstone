import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateStockRunItemDto {
  @IsString()
  rawMaterialId!: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @IsPositive()
  costPerUnit!: number;

  // Quantity covered by the entered price, independent of quantity received.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  costQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  costUnitCode?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
