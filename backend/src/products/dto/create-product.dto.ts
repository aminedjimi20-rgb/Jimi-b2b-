import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class PriceTierInputDto {
  @IsInt()
  @Min(1)
  qteMin!: number;

  @IsOptional()
  @IsInt()
  qteMax?: number;

  @IsNumber()
  @Min(0)
  prix!: number;
}

export class CreateProductDto {
  @IsString()
  nom!: string;

  @IsString()
  code!: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  fabricantId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  taille?: string;

  @IsOptional()
  @IsString()
  couleur?: string;

  @IsOptional()
  @IsString()
  marque?: string;

  @IsNumber()
  @Min(0)
  prixAchat!: number;

  @IsNumber()
  @Min(0)
  prixVente!: number;

  @IsInt()
  @Min(0)
  stockReel!: number;

  @IsInt()
  @Min(0)
  stockMinimum!: number;

  @IsInt()
  @Min(1)
  minCommande!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  uniteParCarton?: number;

  @IsOptional()
  @IsBoolean()
  actif?: boolean;

  @IsOptional()
  @IsArray()
  imageUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => PriceTierInputDto)
  priceTiers?: PriceTierInputDto[];
}
