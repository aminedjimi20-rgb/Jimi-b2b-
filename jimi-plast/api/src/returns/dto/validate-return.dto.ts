import { IsEnum } from 'class-validator';

export class ValidateReturnDto {
  @IsEnum(['REFUND', 'CREDIT_NOTE', 'DEDUCT_NEXT', 'REPLACEMENT'])
  decision!: 'REFUND' | 'CREDIT_NOTE' | 'DEDUCT_NEXT' | 'REPLACEMENT';
}
