import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ProductIngredientUsageScope {
  ONE_DAY = 'ONE_DAY',
  LAST_7_DAYS = 'LAST_7_DAYS',
  LAST_30_DAYS = 'LAST_30_DAYS',
}

export class GetProductIngredientUsageDto {
  @IsEnum(ProductIngredientUsageScope)
  scope!: ProductIngredientUsageScope;

  @IsOptional()
  @IsString()
  businessDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
