import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';
export class AssignUserRoleDto {
  @IsOptional() @IsUUID() roleId?: string;
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  roleIds?: string[];
}
export class UserRoleParamsDto {
  @IsUUID() id: string;
  @IsUUID() roleId: string;
}
