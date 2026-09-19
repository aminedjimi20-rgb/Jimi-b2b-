import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class PurchaseItemInputDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantityPackages!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  actualTotalUnits?: number;

  // Conditionnement réel constaté à la réception (pièces/carton) — si
  // différent du catalogue, remplace product.unitsPerPackage à la
  // confirmation, exactement comme unitCost remplace product.costPrice :
  // l'achat est la source de vérité sur ce que le fournisseur livre
  // réellement.
  @IsOptional()
  @IsInt()
  @Min(1)
  unitsPerPackage?: number;
}

export class UpsertPurchaseVoucherDto {
  @IsOptional()
  @IsString()
  manufacturerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transportCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInputDto)
  items?: PurchaseItemInputDto[];
}
