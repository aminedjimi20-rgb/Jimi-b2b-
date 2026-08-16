import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

// Money ledger entry — money IN from a Client (clientId set, orderId optional)
// or money OUT to a Fabricant (fabricantId set, stockReceiptId optional).
// Exactly one of clientId/fabricantId must be set; enforced in
// PaymentsService since it can't be expressed with class-validator alone.
export class CreatePaymentDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  fabricantId?: string;

  @IsOptional()
  @IsString()
  stockReceiptId?: string;

  @IsNumber()
  @Min(0.01)
  montant!: number;

  @IsIn(['ESPECES', 'VIREMENT', 'BARIDIMOB', 'LIVRAISON', 'CREDIT'])
  method!: 'ESPECES' | 'VIREMENT' | 'BARIDIMOB' | 'LIVRAISON' | 'CREDIT';
}
