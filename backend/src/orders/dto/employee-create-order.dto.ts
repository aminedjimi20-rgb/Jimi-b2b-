import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

// Same shape as a client's own order, plus the target client — used when an
// Employee places an order on the client's behalf at the counter.
// Deliberately has NO remisePourcentage: applying a discount stays an
// Admin-only decision (see AdminCreateOrderDto), an employee can never
// discount an order.
export class EmployeeCreateOrderDto extends CreateOrderDto {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fraisLivraison?: number;

  @IsOptional()
  @IsString()
  transporteurId?: string;

  @IsOptional()
  @IsString()
  destination?: string;
}
