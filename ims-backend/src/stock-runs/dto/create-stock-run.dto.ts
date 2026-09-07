import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateStockRunDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
