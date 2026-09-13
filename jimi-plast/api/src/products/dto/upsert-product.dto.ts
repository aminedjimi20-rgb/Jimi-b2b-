import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProductPriceInputDto } from './product-price.dto';

export class UpsertProductDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @IsOptional()
  @IsString()
  brand?: string;

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
  descriptionFr?: string;

  @IsOptional()
  @IsString()
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  descriptionEn?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, unknown>;

  @IsString()
  packagingUnitId!: string;

  @IsInt()
  @Min(1)
  unitsPerPackage!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMax?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isNew?: boolean;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isSeasonal?: boolean;

  @IsOptional()
  @IsDateString()
  seasonStart?: string;

  @IsOptional()
  @IsDateString()
  seasonEnd?: string;

  @IsOptional()
  @IsInt()
  manualPriority?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductPriceInputDto)
  prices?: ProductPriceInputDto[];
}
