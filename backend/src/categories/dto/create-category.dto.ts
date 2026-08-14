import { IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  nom!: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
