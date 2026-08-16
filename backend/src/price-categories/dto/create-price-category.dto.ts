import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreatePriceCategoryDto {
  @IsString()
  @MinLength(1)
  nom!: string;

  // Grossiste (commande par carton) vs détail (par unité) — pilote le mode
  // de saisie de quantité côté catalogue/panier client (voir Phase 30).
  @IsOptional()
  @IsBoolean()
  orderByCarton?: boolean;
}
