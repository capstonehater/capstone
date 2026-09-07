import {
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateRawMaterialDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  sku!: string;

  @IsString()
  unitId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;
}
