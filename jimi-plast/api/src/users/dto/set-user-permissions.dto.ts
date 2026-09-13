import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

class PermissionOverride {
  @IsString()
  permissionKey!: string;

  @IsBoolean()
  granted!: boolean;
}

export class SetUserPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionOverride)
  overrides!: PermissionOverride[];
}
