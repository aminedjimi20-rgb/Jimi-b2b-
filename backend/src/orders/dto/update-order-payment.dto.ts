import { IsBoolean } from 'class-validator';

export class UpdateOrderPaymentDto {
  @IsBoolean()
  estPayee!: boolean;
}
