import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReverseOrderDto {
  @IsString()
  @MaxLength(255)
  approverEmail!: string;

  @IsString()
  @MaxLength(255)
  approverPassword!: string;

  @IsString()
  @MaxLength(100)
  reasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  paymentReference?: string;
}
