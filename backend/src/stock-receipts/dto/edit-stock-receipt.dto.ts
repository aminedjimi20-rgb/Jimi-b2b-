import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

class EditReceiptItemInputDto {
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

  @IsNumber()
  @Min(0)
  prixVente!: number;
}

/**
 * Correction d'un bon déjà CONFIRMEE (Admin toujours, ou un Employé avec
 * canModifierBonApresConfirmation) — recalcule le delta de stock et le coût
 * réel par article, exactement comme AdminEditOrderDto pour les commandes.
 */
export class EditStockReceiptDto {
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
  @Type(() => EditReceiptItemInputDto)
  items!: EditReceiptItemInputDto[];
}
