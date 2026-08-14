import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsNumber()
  @Min(0.01)
  montant!: number;

  @IsIn(['ESPECES', 'VIREMENT', 'BARIDIMOB', 'LIVRAISON', 'CREDIT'])
  method!: 'ESPECES' | 'VIREMENT' | 'BARIDIMOB' | 'LIVRAISON' | 'CREDIT';
}
