import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateStockMovementDto {
  @IsString()
  productId!: string;

  // VENTE is excluded on purpose — that type is only ever created automatically by OrdersService.
  @IsIn(['ENTREE', 'SORTIE', 'RETOUR', 'AJUSTEMENT'])
  type!: 'ENTREE' | 'SORTIE' | 'RETOUR' | 'AJUSTEMENT';

  // For ENTREE/SORTIE/RETOUR this is a delta quantity (always positive).
  // For AJUSTEMENT this is the new absolute stock value (inventory recount).
  @IsInt()
  @Min(0)
  quantite!: number;

  @IsOptional()
  @IsString()
  motif?: string;
}
