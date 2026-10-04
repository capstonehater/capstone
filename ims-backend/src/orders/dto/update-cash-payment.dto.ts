import { IsNumber, IsPositive, Max } from 'class-validator';

export class UpdateCashPaymentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(9999999999.99)
  amount!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  expectedAmount!: number;
}
