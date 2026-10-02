import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class AddPaymentDto {
  @IsNumber()
  amount!: number; // toujours positif ; le service applique le signe (-)

  @IsOptional()
  @IsString()
  note?: string;
}

export class AddAdjustmentDto {
  @IsNumber()
  amount!: number; // positif = augmente la dette, négatif = la réduit

  @IsString()
  reason!: string;

  @IsOptional()
  @IsIn(['ADJUSTMENT'])
  type?: 'ADJUSTMENT';
}
