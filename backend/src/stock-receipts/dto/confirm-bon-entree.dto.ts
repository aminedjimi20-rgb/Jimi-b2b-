import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

const PAYMENT_METHODS = ['ESPECES', 'VIREMENT', 'BARIDIMOB', 'LIVRAISON', 'CREDIT'] as const;

/** Paiement fournisseur enregistré au moment de la confirmation (Payé/Partiellement payé/Non payé — voir Phase 38). */
export class ConfirmBonEntreeDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  montantPaye?: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: (typeof PAYMENT_METHODS)[number];
}
