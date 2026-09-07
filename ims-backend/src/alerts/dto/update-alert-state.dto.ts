import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAlertStateDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
