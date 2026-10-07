import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsString, MaxLength } from 'class-validator';

export class DeleteResolvedAlertsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  ids!: string[];
}
