import {
  IsArray,
  IsEnum,
  Max,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class CheckoutModifierSelectionDto {
  @IsString()
  modifierId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;
}

export class CheckoutItemDto {
  @IsString()
  productVariantId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutModifierSelectionDto)
  modifiers: CheckoutModifierSelectionDto[] = [];
}

export class CheckoutPaymentDto {
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;
}

export class CheckoutDto {
  @IsString()
  @MaxLength(120)
  idempotencyKey!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDto)
  payments!: CheckoutPaymentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  discountCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  discountRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
