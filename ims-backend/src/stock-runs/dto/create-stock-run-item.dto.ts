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
