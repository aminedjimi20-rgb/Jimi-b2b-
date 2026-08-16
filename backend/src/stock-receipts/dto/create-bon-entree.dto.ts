import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

// prixVente is deliberately absent — a bon d'entrée created by an Employee is
// purchase-only (see Phase 24: no "Total vente" on a bon fournisseur at all),
// the sale price is always derived server-side from the product's own
// prixVente, never entered/seen by the Employee here.
class BonEntreeItemInputDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  cartons!: number;

  @IsInt()
  @Min(1)
  unitesParCarton!: number;

  @IsNumber()
  @Min(0)
  prixAchat!: number;
}

/** Employee draft — see StockReceiptsService.createDraftForEmployee. Never affects stock/fournisseur balance until confirmed. */
export class CreateBonEntreeDto {
  @IsString()
  fabricantId!: string;

  @IsOptional()
  @IsString()
  numeroBonFournisseur?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remisePourcentage?: number;

  @IsOptional()
  @IsString()
  transporteurId?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fraisLivraison?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BonEntreeItemInputDto)
  items!: BonEntreeItemInputDto[];
}
