import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
export class CreateRoleDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;
  @IsString() @MaxLength(500) description: string;
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  permissionKeys: string[];
}
export class UpdateRoleDto extends CreateRoleDto {
  @IsInt() @Min(1) revision: number;
}
export class DeleteRoleDto {
  @IsInt() @Min(1) revision: number;
}
export class RoleIdDto {
  @IsUUID() id: string;
}
