import {
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateInventoryWasteDto {
  @IsString()
  rawMaterialId!: string;

  @IsString()
  batchId!: string;

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
}
