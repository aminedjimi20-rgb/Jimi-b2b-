import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, { message: 'La clé doit être en minuscules, ex: "vip_wholesaler"' })
  key!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
