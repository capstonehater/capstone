import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength, Matches } from 'class-validator';
import { UnitDimension } from '@prisma/client';

export class CreateUnitDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z][A-Z0-9_-]*$/, { message: 'Unit abbreviation must start with a letter and contain only letters, numbers, hyphens, or underscores.' })
  code!: string;

  @IsEnum(UnitDimension)
  dimension!: UnitDimension;
}
