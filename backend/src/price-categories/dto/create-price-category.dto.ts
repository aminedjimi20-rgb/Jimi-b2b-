import { IsString, MinLength } from 'class-validator';

export class CreatePriceCategoryDto {
  @IsString()
  @MinLength(1)
  nom!: string;
}
