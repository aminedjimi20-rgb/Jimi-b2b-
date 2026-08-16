import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  nom!: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  visibleToClient?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleToEmployee?: boolean;
}
