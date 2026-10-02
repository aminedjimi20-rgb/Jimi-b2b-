import { IsBoolean, IsInt, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class UpsertCategoryDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Le slug doit être en minuscules avec des tirets, ex: "plastique"' })
  slug!: string;

  @IsString()
  @MinLength(1)
  nameFr!: string;

  @IsOptional()
  @IsString()
  nameAr?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
