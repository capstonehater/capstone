import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ReplaceVariantRecipeItemDto {
  @IsString()
  @IsNotEmpty()
  rawMaterialId!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  quantity!: string;
}

export class ReplaceVariantRecipeDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceVariantRecipeItemDto)
  items!: ReplaceVariantRecipeItemDto[];
}
