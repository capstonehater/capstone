import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus, PaymentMethod } from '@prisma/client';

export class ListOrdersDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  createdByUserId?: string;

  @IsOptional()
  @IsString()
  staffSearch?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  productVariantId?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
