import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertExpenseCategoryDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
