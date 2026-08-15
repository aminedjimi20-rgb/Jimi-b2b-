import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { CreateOrderDto } from './create-order.dto';

// Same shape as a client's own order, plus the target client — used when an
// Admin places an order on behalf of a walk-in customer at the counter.
// `remisePourcentage` lives ONLY here (never on the base CreateOrderDto) —
// applying a discount is an Admin-only decision, never something a client
// can trigger on their own self-service order.
export class AdminCreateOrderDto extends CreateOrderDto {
  @IsString()
  clientId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remisePourcentage?: number;
}
