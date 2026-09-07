import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class SetManualAvailabilityDto {
  @Type(() => Boolean)
  @IsBoolean()
  isEnabled!: boolean;
}
